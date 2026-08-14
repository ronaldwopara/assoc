/**
 * ASOSC dashboard — server-side Google Sheets bridge
 * =================================================================
 * Deploy target: Vercel Serverless Function.
 * Works unmodified in a Next.js Pages Router project OR a plain
 * Vite/CRA React project on Vercel. (App Router: see NOTE at bottom.)
 *
 * THIS IS THE ONLY FILE THAT HOLDS CREDENTIALS. The browser never
 * sees a service account key, an API key, or a refresh token.
 *
 * WHAT IT DOES
 *   GET  ?action=rows&tab=transactions   -> read a tab
 *   GET  ?action=rows&tab=invoices
 *   GET  ?action=rows&tab=members
 *   POST {action:'approve', ...}         -> write approval columns ONLY
 *   GET  ?action=health                  -> is the pipeline alive
 *
 * WHAT IT DELIBERATELY DOES NOT DO
 *   - No Gmail access. Apps Script owns the inbox.
 *   - No Gemini / Document AI. Parsing happens in Apps Script, once,
 *     at ingest. The dashboard never re-parses.
 *   - No row insertion. Rows are appended by Apps Script or typed by
 *     a human into the sheet. See WRITABLE_COLUMNS.
 *
 * ENVIRONMENT VARIABLES (Vercel project settings)
 *   GOOGLE_SA_KEY_B64   base64 of the service account JSON key file
 *   ASOSC_SHEET_ID      the spreadsheet ID
 *   GOOGLE_CLIENT_ID    OAuth client ID used by Sign in with Google
 *   ALLOWED_EMAILS      comma-separated allowlist, e.g. busayo@asosc.ca
 *   ALLOWED_DOMAIN      optional, e.g. asosc.ca (allows any user on it)
 *   DASHBOARD_PASSWORD  optional fallback if Google sign-in isn't ready
 *
 * SETUP
 *   1. GCP console > IAM > Service Accounts > create one, JSON key.
 *   2. Enable the Google Sheets API on that project.
 *   3. Share the spreadsheet with the service account's email address,
 *      Editor. This is the step everyone forgets. Without it every
 *      call returns AS-11 and the sheet looks fine in your browser.
 *   4. base64 the key file, paste as GOOGLE_SA_KEY_B64.
 */

const { google } = require('googleapis');
const { OAuth2Client } = require('google-auth-library');

// ============================================================ CONFIG

const TABS = {
  transactions: 'Transactions',
  invoices: 'Invoices',
  members: 'Members',
};

/**
 * The write allowlist. If a column header is not in this list, this
 * API physically cannot write to it, regardless of what the client
 * sends. This is what keeps the ledger append-only in practice
 * rather than by convention.
 *
 * CONFIRM THESE AGAINST THE REAL SHEET before first deploy. They are
 * matched case-insensitively on the header text in row 1.
 */
const WRITABLE_COLUMNS = {
  transactions: ['Status', 'Approved By', 'Approved At', 'Notes'],
  invoices: ['Status', 'Approved By', 'Approved At', 'Notes'],
  members: ['Status', 'Approved By', 'Approved At', 'Notes'],
};

/** Column whose value uniquely identifies a row. Never a row number. */
const ROW_KEY_COLUMN = {
  transactions: 'Gmail Message ID',
  invoices: 'Gmail Message ID',
  members: 'Entry ID',
};

const CACHE_MS = 15000;      // Sheets allows 60 reads/min/user. Be polite.
const MAX_ROWS = 5000;

// ============================================================ ERRORS
//
// Short codes Busayo can read out over the phone, continuing the
// AS-0x series used in Apps Script. Keep one lookup table for both.

const ERRORS = {
  'AS-10': 'Not signed in. Sign in with Google and try again.',
  'AS-11': 'Cannot open the sheet. Check the sheet is shared with the service account.',
  'AS-12': 'That tab is missing. Check the tab name in the sheet.',
  'AS-13': 'That row was not found. Try refreshing your sheet.',
  'AS-14': 'Someone else changed this row. Refresh and try again.',
  'AS-15': 'That column cannot be edited from here.',
  'AS-16': 'Google is busy. Wait a moment and try again.',
  'AS-17': 'Setup is incomplete. Contact LOJJ.',
};

function fail(res, code, status = 400, detail) {
  return res.status(status).json({
    ok: false,
    code,
    message: ERRORS[code] || 'Something went wrong.',
    ...(process.env.NODE_ENV !== 'production' && detail ? { detail: String(detail) } : {}),
  });
}

// ============================================================ AUTH

let _oauth;
function oauthClient() {
  if (!_oauth) _oauth = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
  return _oauth;
}

/**
 * Two accepted credentials, in priority order:
 *   1. A Google ID token in `Authorization: Bearer <jwt>`, verified
 *      against Google's keys, then checked against the allowlist.
 *   2. `x-asosc-password` matching DASHBOARD_PASSWORD, if set.
 *
 * Returns { email } on success, throws a code string on failure.
 */
async function authorize(req) {
  const bearer = (req.headers.authorization || '').replace(/^Bearer\s+/i, '').trim();

  if (bearer && process.env.GOOGLE_CLIENT_ID) {
    let payload;
    try {
      const ticket = await oauthClient().verifyIdToken({
        idToken: bearer,
        audience: process.env.GOOGLE_CLIENT_ID,
      });
      payload = ticket.getPayload();
    } catch (e) {
      throw 'AS-10';
    }
    if (!payload || !payload.email || !payload.email_verified) throw 'AS-10';

    const allowed = (process.env.ALLOWED_EMAILS || '')
      .split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
    const domain = (process.env.ALLOWED_DOMAIN || '').trim().toLowerCase();
    const email = payload.email.toLowerCase();

    const okEmail = allowed.includes(email);
    // payload.hd is the Workspace domain claim. Do not trust the email
    // suffix for this — hd is the claim Google actually asserts.
    const okDomain = domain && payload.hd && payload.hd.toLowerCase() === domain;

    if (!okEmail && !okDomain) throw 'AS-10';
    return { email: payload.email };
  }

  const pw = process.env.DASHBOARD_PASSWORD;
  if (pw && req.headers['x-asosc-password'] === pw) {
    return { email: 'password-user' };
  }

  throw 'AS-10';
}

// ============================================================ SHEETS

let _sheets;
function sheetsApi() {
  if (_sheets) return _sheets;

  const b64 = process.env.GOOGLE_SA_KEY_B64;
  if (!b64) throw 'AS-17';

  let creds;
  try {
    creds = JSON.parse(Buffer.from(b64, 'base64').toString('utf8'));
  } catch (e) {
    throw 'AS-17';
  }

  const auth = new google.auth.JWT({
    email: creds.client_email,
    key: creds.private_key,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });

  _sheets = google.sheets({ version: 'v4', auth });
  return _sheets;
}

const cache = new Map(); // tabKey -> { at, payload }

/**
 * Read a whole tab and return it as objects keyed by header text.
 * Header-name resolution, never positional indexing — Apps Script may
 * add a column and every hardcoded index would silently shift.
 */
async function readTab(tabKey, { force = false } = {}) {
  const title = TABS[tabKey];
  if (!title) throw 'AS-12';

  const hit = cache.get(tabKey);
  if (!force && hit && Date.now() - hit.at < CACHE_MS) return hit.payload;

  let resp;
  try {
    resp = await sheetsApi().spreadsheets.values.get({
      spreadsheetId: process.env.ASOSC_SHEET_ID,
      range: `${title}!A1:ZZ${MAX_ROWS}`,
      valueRenderOption: 'UNFORMATTED_VALUE',
      dateTimeRenderOption: 'FORMATTED_STRING',
    });
  } catch (e) {
    const code = e && e.code;
    if (code === 404 || code === 403) throw 'AS-11';
    if (code === 429 || code === 503) throw 'AS-16';
    if (String(e.message || '').includes('Unable to parse range')) throw 'AS-12';
    throw 'AS-11';
  }

  const values = resp.data.values || [];
  const headers = (values[0] || []).map((h) => String(h).trim());

  const rows = values.slice(1).map((r, i) => {
    const obj = { _row: i + 2 }; // 1-indexed sheet row, +1 for header
    headers.forEach((h, c) => {
      if (h) obj[h] = r[c] === undefined ? '' : r[c];
    });
    return obj;
  }).filter((r) => headers.some((h) => h && String(r[h]).length));

  const payload = { headers, rows, tab: title, readAt: new Date().toISOString() };
  cache.set(tabKey, { at: Date.now(), payload });
  return payload;
}

function colLetter(n) { // 0-based -> A, B, ... AA
  let s = '';
  n += 1;
  while (n > 0) {
    const r = (n - 1) % 26;
    s = String.fromCharCode(65 + r) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

// ============================================================ WRITE

/**
 * Update approval fields on one row, addressed by its key value, not
 * by row number. Apps Script appends rows on a 30-minute trigger, so
 * a row index read by the browser thirty seconds ago is not a safe
 * address. We re-resolve the index at write time, every time.
 *
 * `expect` is optimistic concurrency: the client sends the Status it
 * believes is current. If the sheet disagrees, we refuse (AS-14)
 * rather than overwrite someone else's approval.
 */
async function writeApproval({ tabKey, key, updates, expect, actor }) {
  const title = TABS[tabKey];
  if (!title) throw 'AS-12';

  const keyCol = ROW_KEY_COLUMN[tabKey];
  const allowed = (WRITABLE_COLUMNS[tabKey] || []).map((c) => c.toLowerCase());

  for (const col of Object.keys(updates)) {
    if (!allowed.includes(col.toLowerCase())) throw 'AS-15';
  }

  const { headers, rows } = await readTab(tabKey, { force: true });

  const target = rows.find((r) => String(r[keyCol]).trim() === String(key).trim());
  if (!target) throw 'AS-13';

  if (expect !== undefined && expect !== null) {
    const current = String(target.Status === undefined ? '' : target.Status).trim();
    if (current !== String(expect).trim()) throw 'AS-14';
  }

  const stamped = {
    ...updates,
    'Approved By': actor,
    'Approved At': new Date().toISOString(),
  };

  const data = [];
  for (const [col, value] of Object.entries(stamped)) {
    const idx = headers.findIndex((h) => h.toLowerCase() === col.toLowerCase());
    if (idx === -1) continue; // column not present in this tab; skip quietly
    data.push({
      range: `${title}!${colLetter(idx)}${target._row}`,
      values: [[value]],
    });
  }
  if (!data.length) throw 'AS-15';

  try {
    await sheetsApi().spreadsheets.values.batchUpdate({
      spreadsheetId: process.env.ASOSC_SHEET_ID,
      requestBody: { valueInputOption: 'USER_ENTERED', data },
    });
  } catch (e) {
    if (e && (e.code === 429 || e.code === 503)) throw 'AS-16';
    throw 'AS-11';
  }

  cache.delete(tabKey);
  return { key, updated: Object.keys(stamped) };
}

// ============================================================ HEALTH

/**
 * Mirrors the Apps Script daily health check. The failure mode that
 * actually bites is a trigger that silently stops firing — the sheet
 * looks normal, it just quietly stops growing. Surfacing "last row
 * added 3 days ago" on the dashboard is worth more than any parser
 * accuracy improvement.
 */
async function health() {
  const { rows } = await readTab('transactions', { force: true });
  const stamps = rows
    .map((r) => new Date(r['Logged At'] || r['Email Date'] || 0).getTime())
    .filter((n) => Number.isFinite(n) && n > 0);

  const last = stamps.length ? Math.max(...stamps) : null;
  const hours = last ? (Date.now() - last) / 36e5 : null;

  return {
    lastEntryAt: last ? new Date(last).toISOString() : null,
    hoursSinceLastEntry: hours === null ? null : Math.round(hours * 10) / 10,
    stale: hours !== null && hours > 72,
    pendingReview: rows.filter(
      (r) => String(r.Status || '').toLowerCase() === 'needs review'
    ).length,
    totalRows: rows.length,
  };
}

// ============================================================ HANDLER

module.exports = async function handler(req, res) {
  let actor;
  try {
    ({ email: actor } = await authorize(req));
  } catch (code) {
    return fail(res, typeof code === 'string' ? code : 'AS-10', 401);
  }

  try {
    if (req.method === 'GET') {
      const action = req.query.action || 'rows';

      if (action === 'health') {
        return res.status(200).json({ ok: true, data: await health() });
      }
      if (action === 'rows') {
        const tab = String(req.query.tab || 'transactions');
        const force = req.query.force === '1';
        return res.status(200).json({ ok: true, data: await readTab(tab, { force }) });
      }
      return fail(res, 'AS-12', 400);
    }

    if (req.method === 'POST') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};
      if (body.action !== 'approve') return fail(res, 'AS-12', 400);

      const result = await writeApproval({
        tabKey: String(body.tab || 'transactions'),
        key: body.key,
        updates: body.updates || {},
        expect: body.expect,
        actor,
      });
      return res.status(200).json({ ok: true, data: result });
    }

    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ ok: false, code: 'AS-12' });
  } catch (e) {
    if (typeof e === 'string' && ERRORS[e]) {
      return fail(res, e, e === 'AS-14' ? 409 : 500, e);
    }
    return fail(res, 'AS-11', 500, e && e.message);
  }
};

/**
 * NOTE — App Router (app/api/dashboard/route.js)
 * Wrap the same logic in Request/Response instead of req/res:
 *
 *   export async function GET(request) {
 *     const { searchParams } = new URL(request.url);
 *     ...
 *     return Response.json({ ok: true, data });
 *   }
 *
 * The auth, readTab, and writeApproval functions transfer unchanged.
 * Also add `export const dynamic = 'force-dynamic'` so Next does not
 * statically cache a financial ledger.
 */
