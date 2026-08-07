/**
 * ASOSC dashboard — browser client
 * =================================================================
 * Runs in React. Holds NO Google credentials. Its only job is to
 * carry the signed-in user's Google ID token to our own /api route,
 * which is the thing that talks to Google.
 *
 * The ID token is a short-lived assertion of "this is who I am". It
 * is not a key to the sheet. If someone steals it out of the browser
 * they get an identity that expires in an hour and still has to pass
 * the server allowlist. That is the whole reason the split exists.
 */

const API = '/api/dashboard';

// ============================================================ IDENTITY

let _idToken = null;
let _tokenExp = 0;

/** Set by the Google Identity Services callback. See useGoogleSignIn. */
export function setIdToken(jwt) {
  _idToken = jwt || null;
  _tokenExp = 0;
  if (jwt) {
    try {
      const claims = JSON.parse(atob(jwt.split('.')[1]));
      _tokenExp = (claims.exp || 0) * 1000;
    } catch { /* leave 0; server will reject if bad */ }
  }
}

export function getIdentity() {
  if (!_idToken) return null;
  try {
    const c = JSON.parse(atob(_idToken.split('.')[1]));
    return { email: c.email, name: c.name, picture: c.picture, expiresAt: _tokenExp };
  } catch { return null; }
}

export function isSignedIn() {
  return Boolean(_idToken) && (_tokenExp === 0 || Date.now() < _tokenExp - 60000);
}

export function signOut() {
  setIdToken(null);
  if (window.google?.accounts?.id) window.google.accounts.id.disableAutoSelect();
}

// ============================================================ TRANSPORT

export class AsoscError extends Error {
  constructor(code, message, status) {
    super(message);
    this.code = code;       // e.g. 'AS-14'
    this.status = status;
    this.name = 'AsoscError';
  }
}

async function call(path, { method = 'GET', body, signal } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (_idToken) headers.Authorization = `Bearer ${_idToken}`;

  let resp;
  try {
    resp = await fetch(path, {
      method,
      headers,
      signal,
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch (e) {
    if (e.name === 'AbortError') throw e;
    throw new AsoscError('AS-16', 'No connection. Check your internet and try again.', 0);
  }

  let json = {};
  try { json = await resp.json(); } catch { /* empty body */ }

  if (!resp.ok || json.ok === false) {
    throw new AsoscError(
      json.code || 'AS-11',
      json.message || 'Something went wrong.',
      resp.status
    );
  }
  return json.data;
}

// ============================================================ READS

export function fetchRows(tab = 'transactions', { force = false, signal } = {}) {
  const q = new URLSearchParams({ action: 'rows', tab, ...(force ? { force: '1' } : {}) });
  return call(`${API}?${q}`, { signal });
}

export function fetchHealth({ signal } = {}) {
  return call(`${API}?action=health`, { signal });
}

// ============================================================ WRITES

/**
 * One-click approval.
 *
 * `key` is the row's Gmail Message ID (or Entry ID on Members) — not
 * a row number. Apps Script appends rows on a timer, so any index the
 * browser is holding may already be wrong by the time you click.
 *
 * `expect` is the Status you saw when you rendered the row. If the
 * sheet has moved on, the server returns AS-14 instead of clobbering
 * whatever changed. Always pass it.
 */
export function approveRow({ tab = 'transactions', key, status, notes, expect }) {
  const updates = { Status: status };
  if (notes !== undefined) updates.Notes = notes;
  return call(API, {
    method: 'POST',
    body: { action: 'approve', tab, key, updates, expect },
  });
}

export const STATUS = {
  NEEDS_REVIEW: 'Needs Review',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
  DUPLICATE: 'Duplicate',
};

// ============================================================ SHAPING
//
// Column names are resolved server-side from the header row, so the
// objects arriving here use the sheet's own header text as keys. That
// means renaming a header in the sheet renames it here. These helpers
// are the one place that knows the names — keep it that way.

export const FIELD = {
  loggedAt: 'Logged At',
  emailDate: 'Email Date',
  direction: 'Direction',
  amount: 'Amount',
  counterparty: 'Counterparty',
  counterpartyEmail: 'Counterparty Email',
  message: 'Message',
  matchedMember: 'Matched Member',
  tier: 'Tier',
  confidence: 'Confidence',
  status: 'Status',
  messageId: 'Gmail Message ID',
  gmailLink: 'Gmail Link',
  // Invoices tab
  vendor: 'Vendor',
  driveLinks: 'Drive Links',
  detectedBy: 'Detected By',
};

export function needsReview(rows) {
  return rows.filter((r) => String(r[FIELD.status] || '').toLowerCase() === 'needs review');
}

export function toMoney(v) {
  const n = typeof v === 'number' ? v : parseFloat(String(v).replace(/[^0-9.-]/g, ''));
  if (!Number.isFinite(n)) return '—';
  return n.toLocaleString('en-CA', { style: 'currency', currency: 'CAD' });
}

/** Sum inbound minus outbound, for a headline figure. */
export function netTotal(rows) {
  return rows.reduce((sum, r) => {
    const n = parseFloat(String(r[FIELD.amount]).replace(/[^0-9.-]/g, ''));
    if (!Number.isFinite(n)) return sum;
    return String(r[FIELD.direction]).toUpperCase() === 'OUT' ? sum - n : sum + n;
  }, 0);
}
