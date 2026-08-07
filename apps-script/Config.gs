/**
 * ASOSC payments/invoices pipeline — shared config.
 * Paste this alongside PaymentsLogger.gs, InvoiceArchiver.gs, and Setup.gs
 * into ONE Apps Script project bound to the "ASOSC Finances" spreadsheet.
 * See README.md in this folder for install + test steps.
 */

const CONFIG = {
  // This script must be bound to the ASOSC Finances sheet (Extensions > Apps
  // Script, opened FROM that sheet) so FINANCE_SHEET_ID can stay blank.
  FINANCE_SHEET_ID: '',
  MEMBERSHIP_SHEET_ID: '11mIi1S1NYREgQXCVEGwVgkSVVJz504dklGuiIoF30cI',

  // Internal bookkeeping tabs this script owns (created by setupEverything()).
  CONTROL_TAB: 'Automation Log',      // dedupe guard + audit trail of every parsed email
  VENDORS_TAB: 'Invoice Senders',     // Busayo-maintained allowlist: domain or email per row

  DRIVE_FOLDER: 'ASOSC Invoices',

  PROCESSED_LABEL_PAYMENTS: 'asosc/logged',
  PROCESSED_LABEL_INVOICES: 'asosc/invoice-logged',

  TIMEZONE: 'America/Edmonton',
  VERIFY_DKIM: true,                  // guards against spoofed "Interac" emails
  MAX_THREADS_PER_RUN: 100,
  MAX_INVOICE_THREADS_PER_RUN: 60,
  LOOKBACK_DAYS_INVOICES: 90,
  USE_CATEGORY_PURCHASES: true,
  USE_KEYWORD_HEURISTIC: true,
};

const OPS = {
  ALERT_EMAIL: '',            // blank = send to the account owner (whoever authorized the script)
  HEALTH_CHECK_HOURS: 26,     // alert if the payments job hasn't run in this long
};

const SENDERS = {
  'notify@payments.interac.ca': 'IN',   // money received
  'catch@payments.interac.ca': 'OUT',   // money sent
};

// Amount -> membership tier. Informational only — see PaymentsLogger.gs §Matching.
const TIERS = {
  100: 'Organizational',
  30: 'Family',
  15: 'Single/Student',
  10: "Senior's",
};

const KEYWORDS = ['member', 'membership', 'volunteer', 'vendor', 'donation', 'ticket'];

const CONTROL_HEADERS = [
  'Logged At', 'Kind', 'Direction', 'Amount', 'Counterparty Name', 'Counterparty Email',
  'Message', 'Keyword', 'Membership Match', 'Ledger Row Written', 'DKIM', 'Status',
  'Gmail Message ID', 'Subject',
];

const KEYWORD_QUERY =
  '(subject:(invoice OR receipt OR "payment received" OR "your subscription" OR ' +
  '"billing" OR "renewal" OR "order confirmation"))';

const SAVEABLE_MIME = ['application/pdf', 'image/png', 'image/jpeg', 'text/csv'];

// ============================================================ ERROR CODES
//
// AS-01  Can't reach Gmail            AS-05  Payment checks have stopped
// AS-02  Can't write to a sheet       AS-06  Setup didn't finish
// AS-03  One email couldn't be read   AS-07  Interac changed their email format
// AS-04  Couldn't save a file to Drive AS-08  Amount not recognized
// AS-09  Target Sheet/tab not found (e.g. this year's Income/Expenditure tab)
const ERRORS = {
  'AS-01': { msg: "Can't reach Gmail right now.", fix: 'Wait for the next check. If it keeps happening, re-authorize the script.' },
  'AS-02': { msg: "Couldn't write to the sheet.", fix: 'Close and reopen the sheet, then try again.' },
  'AS-03': { msg: "One email couldn't be read.", fix: 'It will be retried automatically. Nothing was lost.' },
  'AS-04': { msg: "Couldn't save a file to Drive.", fix: 'Check the Drive folder still exists and has space.' },
  'AS-05': { msg: 'Payment checks have stopped.', fix: 'Open the sheet and run ASOSC > First-time setup.' },
  'AS-06': { msg: "Setup didn't finish.", fix: 'Run ASOSC > First-time setup again.' },
  'AS-07': { msg: 'Interac changed their email format.', fix: 'Payments are still saved but some fields are blank. Needs a developer.' },
  'AS-08': { msg: 'Amount not recognized on an invoice.', fix: 'Enter it by hand in the Expenditure tab.' },
  'AS-09': { msg: "This year's Income or Expenditure tab doesn't exist yet.", fix: 'Create a tab named like "2027-Income" (copy last year\'s), matching the existing header row, then re-run.' },
};

function errLine(code) {
  const e = ERRORS[code];
  return e ? code + ' — ' + e.msg : code + ' — Something went wrong.';
}

function errBody(code, detail) {
  const e = ERRORS[code] || { msg: 'Something went wrong.', fix: 'Try again.' };
  return code + ' — ' + e.msg + '\n' + e.fix + (detail ? '\n\n---\n' + detail : '');
}

function errAlert(code) {
  SpreadsheetApp.getUi().alert(errLine(code) + '\n\n' + (ERRORS[code] || {}).fix);
}

// ============================================================ SHARED HELPERS

function financeSpreadsheet() {
  return CONFIG.FINANCE_SHEET_ID
    ? SpreadsheetApp.openById(CONFIG.FINANCE_SHEET_ID)
    : SpreadsheetApp.getActiveSpreadsheet();
}

function membershipSpreadsheet() {
  return SpreadsheetApp.openById(CONFIG.MEMBERSHIP_SHEET_ID);
}

function fmt(date) {
  return Utilities.formatDate(date, CONFIG.TIMEZONE, 'yyyy-MM-dd HH:mm:ss');
}

function extractEmail(headerValue) {
  const m = String(headerValue || '').match(/<([^>]+)>/);
  return m ? m[1] : String(headerValue || '').trim();
}

function displayName(headerValue) {
  const s = String(headerValue || '');
  return s.indexOf('<') !== -1 ? s.split('<')[0].replace(/"/g, '').trim() : '';
}

function pick(text, re) {
  const m = String(text || '').match(re);
  return m ? m[1].trim() : '';
}

function money(s) {
  if (!s) return '';
  return Number(String(s).replace(/,/g, ''));
}

function findKeyword(message) {
  if (!message) return '';
  const lower = message.toLowerCase();
  return KEYWORDS.filter(function (k) { return lower.indexOf(k) !== -1; }).join(', ');
}

/**
 * Finds a tab literally named "<year>-<suffix>" (e.g. "2026-Income"). Does
 * NOT create it — the header conventions on these tabs are bookkeeper-owned
 * and have already changed shape between 2025 and 2026, so fabricating a new
 * one automatically risks getting the columns wrong. If it's missing, the
 * caller should log AS-09 and fall back to the control tab only.
 */
function findYearTab(ss, year, suffix) {
  return ss.getSheetByName(year + '-' + suffix);
}

/**
 * Maps a value onto a row shaped for `headers`, matching each header by a
 * lowercase substring rule in `rules` (checked in order, first match wins).
 * Headers with no matching rule are left blank — deliberately: several real
 * columns here (Expense Type, Category, Total recognized in PL, Deferred
 * Income) are bookkeeper judgment calls this pipeline should never guess at.
 */
function fillRowByHeaderRules(headers, rules) {
  return headers.map(function (header) {
    const h = String(header).trim().toLowerCase();
    for (let i = 0; i < rules.length; i++) {
      const needle = rules[i][0];
      const matches = typeof needle === 'string' ? h.indexOf(needle) !== -1 : needle.test(h);
      if (matches) return rules[i][1];
    }
    return '';
  });
}

function getOrCreateTab(ss, name, headers) {
  let tab = ss.getSheetByName(name);
  if (!tab) {
    tab = ss.insertSheet(name);
    tab.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight('bold');
    tab.setFrozenRows(1);
  }
  return tab;
}

function getOrCreateLabel(name) {
  return GmailApp.getUserLabelByName(name) || GmailApp.createLabel(name);
}

function getOrCreateFolder(name) {
  const it = DriveApp.getFoldersByName(name);
  return it.hasNext() ? it.next() : DriveApp.createFolder(name);
}

function getOrCreateSubfolder(parent, name) {
  const it = parent.getFoldersByName(name);
  return it.hasNext() ? it.next() : parent.createFolder(name);
}

/** Appends one row to the shared Automation Log — the dedupe + audit trail for both jobs. */
function appendControlRow(rec) {
  const ss = financeSpreadsheet();
  const tab = getOrCreateTab(ss, CONFIG.CONTROL_TAB, CONTROL_HEADERS);
  const row = CONTROL_HEADERS.map(function (h) { return rec[h] !== undefined ? rec[h] : ''; });
  tab.getRange(tab.getLastRow() + 1, 1, 1, CONTROL_HEADERS.length).setValues([row]);
}

function loadSeenMessageIds() {
  const ss = financeSpreadsheet();
  const tab = ss.getSheetByName(CONFIG.CONTROL_TAB);
  const seen = {};
  if (!tab || tab.getLastRow() < 2) return seen;
  const idCol = CONTROL_HEADERS.indexOf('Gmail Message ID') + 1;
  tab.getRange(2, idCol, tab.getLastRow() - 1, 1).getValues().forEach(function (r) {
    if (r[0]) seen[r[0]] = true;
  });
  return seen;
}

/**
 * Confirms the mail actually came from Interac. The From header is trivially
 * spoofable and Gmail's `from:` search matches it, so without this a phishing
 * email could mark a membership paid or land a fake row in the ledger.
 */
function checkDkim(msg) {
  try {
    const raw = msg.getRawContent();
    const authLine = (raw.match(/^Authentication-Results:[\s\S]*?(?=\n\S)/m) || [''])[0];
    const dkimPass = /dkim=pass/i.test(authLine);
    const rightDomain = /header\.i=@[\w.-]*interac\.ca|header\.d=[\w.-]*interac\.ca/i.test(authLine);
    const spfPass = /spf=pass/i.test(authLine);
    if (dkimPass && rightDomain) return 'pass';
    if (dkimPass || spfPass) return 'partial';
    return 'FAIL';
  } catch (e) {
    return 'unchecked';
  }
}

/**
 * Called from the catch block in each processor. Rate-limited to one alert per
 * job per 6 hours so a persistent failure doesn't flood the inbox — which
 * would train everyone to ignore it.
 */
function notifyFailure(jobName, err, code) {
  try {
    const props = PropertiesService.getScriptProperties();
    const key = 'lastAlert_' + jobName.replace(/\W/g, '');
    const last = Number(props.getProperty(key) || 0);
    if (Date.now() - last < 6 * 60 * 60 * 1000) return;
    props.setProperty(key, String(Date.now()));

    const c = code || 'AS-02';
    MailApp.sendEmail({
      to: OPS.ALERT_EMAIL || Session.getEffectiveUser().getEmail(),
      subject: '[ASOSC] ' + errLine(c),
      body: errBody(c, String(err && err.stack ? err.stack : err)) +
            '\n\nSheet: ' + financeSpreadsheet().getUrl(),
    });
  } catch (e) {
    Logger.log('Alert not sent: ' + e);
  }
}
