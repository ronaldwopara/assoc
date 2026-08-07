/**
 * ASOSC — Setup, menu, and operations.
 * Fourth file alongside Config.gs, PaymentsLogger.gs, InvoiceArchiver.gs.
 *
 * This is the layer that makes the pipeline something Busayo can own rather
 * than something only a developer can run. It provides:
 *   - one-shot setup (control tab, allowlist tab, labels, Drive folder, triggers)
 *   - a spreadsheet menu so nothing requires the script editor
 *   - manual entry for cash payments and manual ledger rows
 *   - failure alerts and a daily health check, so silence is never mistaken
 *     for "nothing happened"
 *
 * INSTALL: paste all four files into one Apps Script project bound to the
 * ASOSC Finances sheet, then run setupEverything() once from here.
 */

// ============================================================ MENU

/** Runs automatically when the sheet is opened. */
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('ASOSC')
    .addItem('Check for new payments now', 'processInteracEmails')
    .addItem('Check for new invoices now', 'processInvoiceEmails')
    .addSeparator()
    .addItem('Record a cash / manual payment', 'showManualPaymentDialog')
    .addSeparator()
    .addItem('Run pipeline health check', 'checkPipelineHealth')
    .addItem('Test invoice detection', 'testDetectionStrategies')
    .addSeparator()
    .addItem('First-time setup', 'setupEverything')
    .addToUi();
}

// ============================================================ SETUP

/**
 * Idempotent. Safe to re-run — creates only what is missing and never
 * overwrites existing data. Does NOT touch Surplus/Balance Sheet/Income/
 * Expenditure tabs (those are bookkeeper-owned and already exist).
 */
function setupEverything() {
  const ss = financeSpreadsheet();
  const notes = [];

  if (!ss.getSheetByName(CONFIG.CONTROL_TAB)) {
    getOrCreateTab(ss, CONFIG.CONTROL_TAB, CONTROL_HEADERS);
    notes.push('Created tab: ' + CONFIG.CONTROL_TAB);
  }
  if (!ss.getSheetByName(CONFIG.VENDORS_TAB)) {
    const created = ss.insertSheet(CONFIG.VENDORS_TAB);
    created.getRange(1, 1, 1, 2)
      .setValues([['Sender (domain or email)', 'Notes']])
      .setFontWeight('bold');
    created.setFrozenRows(1);
    notes.push('Created tab: ' + CONFIG.VENDORS_TAB);
  }

  const thisYear = String(new Date().getFullYear());
  if (!findYearTab(ss, thisYear, 'Income') || !findYearTab(ss, thisYear, 'Expenditure')) {
    notes.push(
      'WARNING: ' + thisYear + '-Income or ' + thisYear + '-Expenditure tab is ' +
      "missing. Copy last year's tab (keep its header row) and rename it, " +
      'or new payments/invoices will only reach the Automation Log until it exists.'
    );
  }

  getOrCreateLabel(CONFIG.PROCESSED_LABEL_PAYMENTS);
  getOrCreateLabel(CONFIG.PROCESSED_LABEL_INVOICES);
  notes.push('Gmail labels ready: ' + CONFIG.PROCESSED_LABEL_PAYMENTS + ', ' + CONFIG.PROCESSED_LABEL_INVOICES);

  const folder = getOrCreateFolder(CONFIG.DRIVE_FOLDER);
  notes.push('Drive folder: ' + folder.getUrl());

  installTrigger();            // payments, every 30 min
  installInvoiceTrigger();     // invoices, every 4 hours
  installHealthTrigger();      // health check, daily
  notes.push('Triggers installed (payments 30min / invoices 4h / health daily).');

  SpreadsheetApp.getUi().alert('ASOSC setup complete\n\n' + notes.join('\n'));
}

// ============================================================ MANUAL ENTRY

/**
 * Covers the case an email will never generate: cash handed over at an
 * event, an e-transfer sent from an unregistered address, etc. Two modes so
 * one dialog can't accidentally write to the wrong place:
 *   "membership" — marks PAID OR NOT on the Membership sheet by email, same
 *                  function the automated path uses.
 *   "income" / "expenditure" — appends a row to this year's tab with only
 *                  Vendor/Amount/Date/Notes filled; Expense Type, Category,
 *                  and Purpose are left for Busayo to fill in the sheet
 *                  directly, same as every automated row.
 */
function showManualPaymentDialog() {
  const ui = SpreadsheetApp.getUi();

  const kind = promptOrCancel(ui, 'Type: "membership", "income", or "expenditure"');
  if (kind === null) return;
  const k = kind.trim().toLowerCase();

  if (k === 'membership') {
    const email = promptOrCancel(ui, "Member's email, exactly as in the Membership sheet's Email column");
    if (email === null) return;
    const match = markMembershipPaidByEmail(String(email).trim().toLowerCase());
    ui.alert(match ? 'Marked paid: ' + match : 'No membership row found with that email. Nothing changed.');
    return;
  }

  if (k !== 'income' && k !== 'expenditure') {
    ui.alert('Type must be exactly "membership", "income", or "expenditure". Nothing was saved.');
    return;
  }

  const who = promptOrCancel(ui, k === 'income' ? 'Donor / payer name' : 'Vendor name');
  if (who === null) return;
  const amountRaw = promptOrCancel(ui, 'Amount, numbers only (e.g. 15.00)');
  if (amountRaw === null) return;
  const note = promptOrCancel(ui, 'Note (e.g. "cash at Aug 6 event")');
  if (note === null) return;

  const amt = Number(String(amountRaw).replace(/[^\d.]/g, ''));
  if (!amt) { ui.alert('That amount could not be read. Nothing was saved.'); return; }

  const ss = financeSpreadsheet();
  const year = String(new Date().getFullYear());
  const suffix = k === 'income' ? 'Income' : 'Expenditure';
  const tab = findYearTab(ss, year, suffix);
  if (!tab) {
    ui.alert(errLine('AS-09'));
    return;
  }

  const headers = tab.getRange(1, 1, 1, tab.getLastColumn()).getValues()[0];
  const dateStr = Utilities.formatDate(new Date(), CONFIG.TIMEZONE, 'yyyy-MM-dd');
  const fullNote = 'Manually recorded by ' + Session.getActiveUser().getEmail() +
    (note ? ' — ' + note : '');

  const rules = k === 'income'
    ? [
        ['purpose', ''],
        [/amount received/, amt],
        [/recognized/, ''],
        [/deferred/, ''],
        ['notes', fullNote],
        [/.*/, who],
      ]
    : [
        ['expense type', ''],
        ['category', ''],
        ['description', note || ''],
        ['vendor', who],
        [/cost/, amt],
        ['notes', fullNote],
        ['date', dateStr],
        ['invoice number', ''],
      ];

  const row = fillRowByHeaderRules(headers, rules);
  tab.getRange(tab.getLastRow() + 1, 1, 1, headers.length).setValues([row]);
  ui.alert('Recorded: ' + who + ' — $' + amt.toFixed(2) + ' (' + suffix + ')');
}

function promptOrCancel(ui, question) {
  const res = ui.prompt(question, ui.ButtonSet.OK_CANCEL);
  return res.getSelectedButton() === ui.Button.OK ? res.getResponseText().trim() : null;
}

// ============================================================ HEALTH

/**
 * Guards against the failure mode alerts cannot catch: a trigger that was
 * deleted, disabled, or revoked, so nothing runs and nothing throws.
 */
function checkPipelineHealth() {
  const props = PropertiesService.getScriptProperties();
  const last = props.getProperty('lastInteracRun');
  const problems = [];

  if (!last) {
    problems.push('The payments job has never recorded a successful run.');
  } else {
    const hours = (Date.now() - new Date(last).getTime()) / 36e5;
    if (hours > OPS.HEALTH_CHECK_HOURS) {
      problems.push('Payments job last ran ' + Math.round(hours) + ' hours ago.');
    }
  }

  const handlers = ScriptApp.getProjectTriggers().map(function (t) { return t.getHandlerFunction(); });
  ['processInteracEmails', 'processInvoiceEmails'].forEach(function (h) {
    if (handlers.indexOf(h) === -1) problems.push('Trigger missing for ' + h + '.');
  });

  const thisYear = String(new Date().getFullYear());
  const ss = financeSpreadsheet();
  if (!findYearTab(ss, thisYear, 'Income') || !findYearTab(ss, thisYear, 'Expenditure')) {
    problems.push(thisYear + '-Income or ' + thisYear + '-Expenditure tab is missing.');
  }

  if (!problems.length) {
    Logger.log('Health check OK. Last payments run: ' + last);
    return;
  }

  MailApp.sendEmail({
    to: OPS.ALERT_EMAIL || Session.getEffectiveUser().getEmail(),
    subject: '[ASOSC] ' + errLine('AS-05'),
    body: errBody('AS-05', problems.join('\n')) + '\n\nSheet: ' + ss.getUrl(),
  });
  Logger.log('AS-05: ' + problems.join(' | '));
}

function installHealthTrigger() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'checkPipelineHealth') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('checkPipelineHealth').timeBased().everyDays(1).atHour(8).create();
}
