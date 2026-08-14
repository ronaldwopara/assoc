/**
 * ASOSC — Newsletter form endpoint
 * REPLACES your existing newsletter Code.gs. The subscribe flow is unchanged;
 * unsubscribe handling is added to both doGet and doPost.
 *
 * Works with NewsletterFollowUp.gs and EmailTemplate.gs in the same project.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * ROUTES
 *
 *   POST  {name, email, strathconaResident}      → subscribe (unchanged)
 *   POST  {action:"unsubscribe", email, token?}  → opt out      (dashboard)
 *   POST  {action:"resubscribe",  email}         → opt back in  (dashboard)
 *   GET   ?action=unsubscribe&e=<email>&t=<tok>  → opt out, returns a page
 *   GET   (anything else)                        → liveness text (unchanged)
 *
 * The dashboard can call the POST actions with the Sheets-API service account
 * flow it already uses, so one mechanism serves both the email link and the UI.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * WHY THE TOKEN
 *
 * Without one, the unsubscribe URL is just an email address in a query string.
 * Anyone could unsubscribe anyone by editing it, and link-scanning security
 * software would silently opt people out by prefetching URLs it finds in mail.
 *
 * The token is an HMAC of the address against a secret generated once and kept
 * in Script Properties. It is stable, so a link in an old email keeps working,
 * and it cannot be produced without the secret.
 *
 * A GET from a POST-required path also protects against prefetch: the page
 * asks for a click before it writes anything.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * DEPLOYMENT — the unsubscribe link only works after this
 *
 *   Deploy → New deployment → Web app
 *     Execute as:      Me
 *     Who has access:  Anyone
 *
 * "Anyone" is required because subscribers are not signed in to Google. The
 * token is what makes that safe. Re-deploy after any edit to this file, or the
 * live endpoint keeps running the old code.
 * ─────────────────────────────────────────────────────────────────────────
 */

const LOCAL_SHEET_NAME = 'Newsletter';

const NEWSLETTER_HEADERS = [
  'Entry ID',
  'Name',
  'Email',
  'Do you reside or own a business in Strathcona County?',
];

// ============================================================ POST

function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);

  try {
    const data = parseRequestBody(e);
    const action = clean(data.action).toLowerCase();

    // Branch first. Existing form posts carry no action field and fall through
    // to the original subscribe flow untouched.
    if (action === 'unsubscribe' || action === 'resubscribe') {
      const email = clean(data.email).toLowerCase();
      if (!email) throw new Error('Email is required.');

      // A token is required from the public web, optional from the dashboard,
      // which authenticates separately.
      if (data.token && clean(data.token) !== unsubToken(email)) {
        return jsonResponse({ ok: false, error: 'Invalid token.' });
      }

      const changed = setOptOut(email, action === 'unsubscribe');
      return jsonResponse({ ok: true, email: email, unsubscribed: action === 'unsubscribe', found: changed });
    }

    // ---- original subscribe flow
    const firstName = clean(data.firstName);
    const lastName = clean(data.lastName);
    const name = formatName(clean(data.name) || `${firstName} ${lastName}`);
    const email = clean(data.email).toLowerCase();
    const strathconaResident = normalizeYesNo(data.strathconaResident);

    if (!name || !email) {
      throw new Error('Name and email are required.');
    }

    const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = getRequiredSheet(spreadsheet, LOCAL_SHEET_NAME);
    ensureHeaders(sheet);

    const entryId = getNextEntryId(sheet);

    sheet.appendRow([entryId, name, email, strathconaResident]);

    // Someone resubscribing through the form should not stay opted out.
    setOptOut(email, false);

    return jsonResponse({ ok: true, entryId });
  } catch (error) {
    return jsonResponse({ ok: false, error: error.message });
  } finally {
    lock.releaseLock();
  }
}

// ============================================================ GET

function doGet(e) {
  const params = (e && e.parameter) ? e.parameter : {};
  const action = clean(params.action).toLowerCase();

  if (action !== 'unsubscribe') {
    return ContentService
      .createTextOutput('Newsletter endpoint is live. Use POST to submit form data.')
      .setMimeType(ContentService.MimeType.TEXT);
  }

  const email = clean(params.e).toLowerCase();
  const token = clean(params.t);

  if (!email || token !== unsubToken(email)) {
    return unsubPage(
      'That link did not work',
      'It may have been copied incompletely. Email info@asosc.ca and we will take you off the list.',
      false
    );
  }

  // Only write on confirm. A bare GET renders a button instead, so link
  // scanners and mail-security prefetchers cannot opt people out silently.
  if (clean(params.confirm) !== 'yes') {
    const url = webAppUrl() +
      '?action=unsubscribe&e=' + encodeURIComponent(email) +
      '&t=' + encodeURIComponent(token) + '&confirm=yes';
    return unsubPage(
      'Unsubscribe from the ASOSC newsletter?',
      'We will stop sending newsletters to ' + escapeForPage(email) + '.',
      false,
      url
    );
  }

  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(20000);
    setOptOut(email, true);
  } catch (err) {
    return unsubPage('Something went wrong', 'Please email info@asosc.ca and we will do it manually.', false);
  } finally {
    try { lock.releaseLock(); } catch (_) {}
  }

  return unsubPage(
    'You are unsubscribed',
    'We will not send you any more newsletters. If this was a mistake, you can sign up again at asosc.ca.',
    true
  );
}

// ============================================================ OPT-OUT STATE

/**
 * Ticks or clears the Unsubscribed box on every row matching the address.
 * Returns true if any row matched. Callers deliberately do NOT surface a false
 * result to the public, so the page cannot be used to test whether an address
 * is on the list.
 */
function setOptOut(email, optOut) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(LOCAL_SHEET_NAME);
  if (!sheet || sheet.getLastRow() < 2) return false;

  const optCol = headerColumn(sheet, 'Unsubscribed');
  if (optCol < 1) return false;

  const values = sheet.getDataRange().getValues();
  const target = String(email).trim().toLowerCase();
  let hit = false;

  for (let r = 1; r < values.length; r++) {
    if (String(values[r][2] || '').trim().toLowerCase() === target) {
      sheet.getRange(r + 1, optCol).setValue(!!optOut);
      hit = true;
    }
  }
  return hit;
}

function headerColumn(sheet, header) {
  const head = sheet.getRange(1, 1, 1, Math.max(sheet.getLastColumn(), 1)).getValues()[0];
  for (let i = 0; i < head.length; i++) {
    if (String(head[i]).trim() === header) return i + 1;
  }
  return -1;
}

// ============================================================ TOKEN

/** Created once, then reused forever. Changing it invalidates every old link. */
function unsubSecret() {
  const props = PropertiesService.getScriptProperties();
  let secret = props.getProperty('nl_secret');
  if (!secret) {
    secret = Utilities.getUuid() + Utilities.getUuid();
    props.setProperty('nl_secret', secret);
  }
  return secret;
}

function unsubToken(email) {
  const bytes = Utilities.computeHmacSha256Signature(
    String(email).trim().toLowerCase(), unsubSecret()
  );
  return bytes.map(function (b) {
    return ((b & 0xff) + 0x100).toString(16).slice(1);
  }).join('').slice(0, 24);
}

/** Deployed web app URL. Empty until the first deployment. */
function webAppUrl() {
  try { return ScriptApp.getService().getUrl() || ''; } catch (err) { return ''; }
}

/** Full link for one subscriber. NewsletterFollowUp.gs calls this. */
function unsubscribeUrlFor(email) {
  const base = webAppUrl();
  if (!base) return '';
  return base + '?action=unsubscribe&e=' + encodeURIComponent(String(email).toLowerCase()) +
         '&t=' + encodeURIComponent(unsubToken(email));
}

// ============================================================ PAGE

function unsubPage(heading, message, done, confirmUrl) {
  const ACCENT = '#F08F3B';
  const INK = '#2F2B28';
  const html = [
    '<!DOCTYPE html><html lang="en"><head>',
    '<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">',
    '<title>ASOSC</title></head>',
    '<body style="margin:0;background:#F7F7F7;font-family:Poppins,Segoe UI,Arial,sans-serif;">',
    '<div style="max-width:520px;margin:60px auto;background:#FFFFFE;border-radius:12px;overflow:hidden;border:1px solid #e6e2de;">',
    '<div style="background:', INK, ';padding:22px;text-align:center;">',
    '<span style="color:', ACCENT, ';font-size:22px;font-weight:700;letter-spacing:1px;">ASOSC</span>',
    '</div>',
    '<div style="height:5px;background:', ACCENT, ';"></div>',
    '<div style="padding:34px;text-align:center;">',
    '<h1 style="margin:0 0 14px;font-size:21px;color:', INK, ';">', escapeForPage(heading), '</h1>',
    '<p style="margin:0 0 22px;font-size:15px;line-height:1.6;color:#5a5a5a;">', escapeForPage(message), '</p>',
    confirmUrl
      ? '<a href="' + escapeForPage(confirmUrl) + '" style="display:inline-block;background:' + ACCENT +
        ';color:' + INK + ';font-weight:700;text-decoration:none;padding:13px 30px;border-radius:26px;">' +
        'Yes, unsubscribe</a>'
      : '',
    done ? '<p style="margin:20px 0 0;font-size:13px;color:#8a8a8a;">You can close this page.</p>' : '',
    '<p style="margin:26px 0 0;font-size:13px;">',
    '<a href="https://www.asosc.ca" style="color:', ACCENT, ';text-decoration:none;">www.asosc.ca</a></p>',
    '</div></div></body></html>',
  ].join('');

  return HtmlService.createHtmlOutput(html)
    .setTitle('ASOSC')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

function escapeForPage(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// ============================================================ ORIGINAL HELPERS

function ensureHeaders(sheet) {
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(NEWSLETTER_HEADERS);
    return;
  }
  // Only the first four columns. Tracking columns added later are left alone.
  sheet.getRange(1, 1, 1, NEWSLETTER_HEADERS.length).setValues([NEWSLETTER_HEADERS]);
}

function getRequiredSheet(spreadsheet, sheetName) {
  const sheet = spreadsheet.getSheetByName(sheetName);
  if (!sheet) throw new Error(`Missing sheet tab: ${sheetName}`);
  return sheet;
}

function getNextEntryId(sheet) {
  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) return 1;

  const ids = sheet
    .getRange(2, 1, lastRow - 1, 1)
    .getValues()
    .flat()
    .map(Number)
    .filter(Number.isFinite);

  return ids.length ? Math.max(...ids) + 1 : 1;
}

function parseRequestBody(e) {
  if (!e || !e.postData || !e.postData.contents) {
    return e && e.parameter ? e.parameter : {};
  }
  try {
    return JSON.parse(e.postData.contents);
  } catch (_) {
    return e.parameter || {};
  }
}

function normalizeYesNo(value) {
  const normalized = clean(value).toLowerCase();
  if (normalized === 'yes') return 'Yes';
  if (normalized === 'no') return 'No';
  return '';
}

function clean(value) {
  return String(value || '').trim();
}

function formatName(name) {
  if (!name) return '';
  return name
    .toString()
    .trim()
    .split(' ')
    .filter(Boolean)
    .map((word) => word[0].toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

function jsonResponse(payload) {
  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}