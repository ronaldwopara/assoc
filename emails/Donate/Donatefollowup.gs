/**
 * ASOSC — Donation acknowledgement
 * Add as a NEW file in the donate project, alongside Donate_Code.gs (pasted
 * over the old Code.gs) and EmailTemplate.gs.
 *
 * Sheet layout expected:
 *   A Entry ID | B Timestamp | C Amount (CAD) | D Payment Method
 *   E PAID OR NOT | F Donor Name | G Donor Email | H Donor Phone
 *   ...then two columns this script adds: Thanks Sent, Thanks Note
 *
 * Columns are resolved BY HEADER NAME, not position. The donate sheet already
 * had its shape changed once; a third change should not silently break this.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * THIS IS NOT A TAX RECEIPT
 *
 * The email says thank you and confirms what was pledged. It deliberately does
 * not call itself a receipt, state a charitable registration number, or use
 * language implying it can be filed with a tax return. Getting that wrong is
 * a problem for ASOSC, not for whoever wrote the template.
 *
 * If ASOSC issues official donation receipts, confirm the requirements with
 * whoever handles their filings and treat receipt issuance as separate work.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * WHY THE E-TRANSFER INSTRUCTIONS MATTER
 *
 * This email is the best moment to tell an e-transfer donor to put a keyword
 * in the Interac message field. They are about to open their banking app.
 *
 * Without that keyword the payment parser cannot tell a $15 donation from a
 * $15 Single/Student membership, because ASOSC receives money constantly in
 * arbitrary amounts. The instruction here is what makes the ledger usable.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * SAFEGUARDS — same six as the other forms.
 *   1. WATERMARK   Entries existing at install time are permanently excluded.
 *                  Blank or non-numeric Entry IDs are skipped too.
 *   2. SENT COLUMN Per-row timestamp. Never sends twice.
 *   3. ARMING      Off until deliberately turned on from the menu.
 *   4. BATCH CAP   5 per run.
 *   5. DAILY CAP   25 per day.
 *   6. CIRCUIT     More than 15 suddenly pending stops everything.
 *
 * Rows with no donor email are skipped, which is every row submitted before
 * the website starts sending donorEmail. That is expected, not a fault.
 */

const DN = {
  FORM_TAB: 'Donations',
  TEMPLATE_TAB: 'Thank You Email',
  SENT_COL_HEADER: 'Thanks Sent',
  NOTE_COL_HEADER: 'Thanks Note',

  COL_ENTRY: 'Entry ID',
  COL_AMOUNT: 'Amount (CAD)',
  COL_METHOD: 'Payment Method',
  COL_NAME: 'Donor Name',
  COL_EMAIL: 'Donor Email',

  MAX_PER_RUN: 5,
  MAX_PER_DAY: 25,
  CIRCUIT_BREAKER: 15,

  NOTIFY_EMAIL: '',        // blank = the account running the script
  REPLY_TO: 'support@asosc.ca',
  FROM_EMAIL: 'support@asosc.ca',
  FROM_NAME: 'ASOSC',
  ETRANSFER_TO: 'payment@asosc.ca',
};

// ============================================================ MENU

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Donation thanks')
    .addItem('Preview who would get an email', 'previewDonationThanks')
    .addItem('Why rows are skipped', 'explainDonationSkips')
    .addItem('Send me a test copy', 'sendDonationTestToMe')
    .addSeparator()
    .addItem('Send pending thanks now', 'sendDonationFromMenu')
    .addSeparator()
    .addItem('Turn sending ON', 'armDonations')
    .addItem('Turn sending OFF', 'disarmDonations')
    .addItem('Status', 'showDonationStatus')
    .addSeparator()
    .addItem('Allow emails for existing rows', 'includeExistingDonations')
    .addItem('First-time setup', 'setupDonations')
    .addToUi();
}

// ============================================================ SETUP

function setupDonations() {
  const ui = SpreadsheetApp.getUi();
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const form = ss.getSheetByName(DN.FORM_TAB);
  if (!form) { ui.alert('DN-01 — Cannot find the ' + DN.FORM_TAB + ' tab.'); return; }

  dnEnsureTemplateTab(ss);
  dnEnsureTrackingColumns(form);

  const existingMax = dnMaxEntryId(form);
  const props = PropertiesService.getScriptProperties();
  props.setProperty('dn_watermark', String(existingMax));
  props.setProperty('dn_armed', 'no');

  installDonationTrigger();

  const emailCol = dnColumnIndex(form, DN.COL_EMAIL);
  const warning = emailCol < 1
    ? '\n\nHEADS UP: there is no "' + DN.COL_EMAIL + '" column yet. Paste the ' +
      'updated Code.gs and make sure the website posts donorEmail, or nothing ' +
      'will ever send.'
    : '';

  ui.alert(
    'Setup done.\n\n' +
    'Entries 1 to ' + existingMax + ' will never be emailed by this script.\n' +
    'Only donations recorded from now on are eligible.\n\n' +
    'Sending is currently OFF. Edit the wording in the "' + DN.TEMPLATE_TAB +
    '" tab, preview it, then turn sending on when you are happy.' + warning
  );
}

function dnEnsureTemplateTab(ss) {
  let tab = ss.getSheetByName(DN.TEMPLATE_TAB);
  if (tab) return tab;

  tab = ss.insertSheet(DN.TEMPLATE_TAB);
  tab.getRange('A1').setValue(dnDefaultBody());
  tab.getRange('B1').setValue('Thank you for supporting ASOSC');
  tab.getRange('B2').setValue('See what your support funds');
  tab.getRange('B3').setValue('https://www.asosc.ca/#programs');
  tab.getRange('B4').setValue('');
  tab.getRange('B5').setValue(dnDefaultEtransferBlock());
  tab.getRange('B6').setValue(dnDefaultCardBlock());

  tab.getRange('A3').setValue('Body in A1. Subject B1. Button label B2, link B3. Preview text B4.');
  tab.getRange('A4').setValue('B5 = instructions shown to Interac e-transfer donors. B6 = instructions shown to card donors.');
  tab.getRange('A5').setValue('Placeholders: {{first_name}}, {{name}}, {{amount}}, {{method}}, {{payment_instructions}}');
  tab.getRange('A6').setValue('Keep the message-field instruction in B5. Without it we cannot tell a donation from a membership payment.');
  tab.getRange('A3:A6').setFontStyle('italic').setFontColor('#666666');

  tab.setColumnWidth(1, 620);
  tab.setColumnWidth(2, 400);
  tab.getRange('A1').setWrap(true).setVerticalAlignment('top');
  tab.getRange('B5:B6').setWrap(true).setVerticalAlignment('top');
  tab.setRowHeight(1, 300);
  return tab;
}

function dnEnsureTrackingColumns(form) {
  const head = form.getRange(1, 1, 1, Math.max(form.getLastColumn(), 1)).getValues()[0]
    .map(function (h) { return String(h).trim(); });

  [DN.SENT_COL_HEADER, DN.NOTE_COL_HEADER].forEach(function (name) {
    if (head.indexOf(name) === -1) {
      form.getRange(1, form.getLastColumn() + 1).setValue(name).setFontWeight('bold');
    }
  });
}

function installDonationTrigger() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'sendDonationThanks') ScriptApp.deleteTrigger(t);
  });
  // Every 15 minutes. An e-transfer donor needs the payment instructions while
  // they are still sitting at their banking app, not an hour later.
  ScriptApp.newTrigger('sendDonationThanks').timeBased().everyMinutes(15).create();
}

// ============================================================ ARMING

function armDonations() {
  const ui = SpreadsheetApp.getUi();
  const pending = dnFindPending();
  const res = ui.alert(
    'Turn sending on?',
    pending.length + ' donation(s) are waiting for a thank you right now.\n\n' +
    'Up to ' + DN.MAX_PER_RUN + ' per run, ' + DN.MAX_PER_DAY + ' per day.\n\nContinue?',
    ui.ButtonSet.YES_NO
  );
  if (res !== ui.Button.YES) return;
  PropertiesService.getScriptProperties().setProperty('dn_armed', 'yes');
  ui.alert('Sending is now ON.');
}

function disarmDonations() {
  PropertiesService.getScriptProperties().setProperty('dn_armed', 'no');
  SpreadsheetApp.getUi().alert('Sending is now OFF. Nothing will go out.');
}

function showDonationStatus() {
  const props = PropertiesService.getScriptProperties();
  const form = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(DN.FORM_TAB);
  const hasEmailCol = form && dnColumnIndex(form, DN.COL_EMAIL) > 0;

  SpreadsheetApp.getUi().alert(
    'Sending: ' + (props.getProperty('dn_armed') === 'yes' ? 'ON' : 'OFF') + '\n' +
    'Waiting for a thank you: ' + dnFindPending().length + '\n' +
    'Sent today: ' + dnSentToday() + ' of ' + DN.MAX_PER_DAY + '\n' +
    'Skipping entries 1 to ' + (props.getProperty('dn_watermark') || '?') + '\n' +
    'Donor Email column: ' + (hasEmailCol ? 'present' : 'MISSING — nothing can send') + '\n' +
    'Gmail quota left today: ' + MailApp.getRemainingDailyQuota()
  );
}

// ============================================================ PREVIEW / TEST

function previewDonationThanks() {
  const pending = dnFindPending();
  const ui = SpreadsheetApp.getUi();
  if (!pending.length) {
    const d = dnDiagnoseRows();
    ui.alert(
      'No donations are waiting.\n\n' +
      (d.missing
        ? d.missing
        : 'Rows are on the sheet, but every one is skipped:\n\n' +
          d.lines.slice(-12).join('\n') +
          '\n\nIf you see "frozen by setup", use Donation thanks → Allow emails for existing rows.')
    );
    return;
  }
  const lines = pending.slice(0, 20).map(function (p) {
    return '  ' + (p.name || '(no name)') + '  <' + p.email + '>  ' + dnMoney(p.amount);
  });
  ui.alert(
    pending.length + ' waiting. The next run would email up to ' + DN.MAX_PER_RUN + ':\n\n' +
    lines.join('\n') + (pending.length > 20 ? '\n  ...and ' + (pending.length - 20) + ' more' : '')
  );
}

function explainDonationSkips() {
  const d = dnDiagnoseRows();
  const ui = SpreadsheetApp.getUi();
  if (d.missing) {
    ui.alert(d.missing);
    return;
  }
  if (!d.lines.length) {
    ui.alert('No donation rows yet.');
    return;
  }
  ui.alert(
    'Skipping entries 1 to ' + d.watermark + '.\n\n' +
    d.lines.join('\n')
  );
}

/**
 * First-time setup freezes every Entry ID that already existed so old
 * records never get a surprise email. That is why Preview is empty for
 * Ronald's rows even though Donor Email is filled: they were already on
 * the sheet when setup ran.
 */
function includeExistingDonations() {
  const ui = SpreadsheetApp.getUi();
  const form = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(DN.FORM_TAB);
  if (!form) { ui.alert('DN-01 — Cannot find the ' + DN.FORM_TAB + ' tab.'); return; }

  const res = ui.alert(
    'Allow emails for rows that already exist?',
    'This unfreezes donations that were on the sheet before First-time setup. ' +
    'Rows with no Donor Email, and rows already marked sent, stay skipped.\n\nContinue?',
    ui.ButtonSet.YES_NO
  );
  if (res !== ui.Button.YES) return;

  dnEnsureTrackingColumns(form);
  PropertiesService.getScriptProperties().setProperty('dn_watermark', '0');

  const pending = dnFindPending();
  ui.alert(
    'Existing rows can now be emailed.\n\n' +
    pending.length + ' donation(s) are waiting.\n\n' +
    'Next: Preview, then Send pending thanks now.\n' +
    'Do not run First-time setup again — that would freeze them once more.'
  );
}

/**
 * Headless variant for `clasp run`. SpreadsheetApp.getUi() is unavailable
 * outside the sheet menu, so this skips every alert, unfreezes watermarked
 * rows, and sends immediately.
 */
function claspUnfreezeAndSend() {
  const form = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(DN.FORM_TAB);
  if (!form) throw new Error('DN-01 — Cannot find the ' + DN.FORM_TAB + ' tab.');
  dnEnsureTrackingColumns(form);
  PropertiesService.getScriptProperties().setProperty('dn_watermark', '0');
  const sent = sendDonationThanks(true);
  return {
    sent: sent,
    stillWaiting: dnFindPending().length,
  };
}

/** Sends both variants so you can compare the e-transfer and card wording. */
function sendDonationTestToMe() {
  const t = dnReadTemplate();
  const to = Session.getEffectiveUser().getEmail();

  [['Interac e-transfer', 50], ['Card', 25]].forEach(function (pair) {
    const sample = {
      name: 'Sample Donor', firstName: 'Sample', email: to,
      amount: pair[1], method: pair[0], entryId: 0,
    };
    const body = dnRenderBody(t.body, sample, t);
    dnSendDonorEmail({
      to: to,
      subject: '[TEST ' + pair[0] + '] ' + t.subject,
      body: body,
      htmlBody: buildBrandedEmail(body, t),
    });
  });

  SpreadsheetApp.getUi().alert('Two test emails sent to ' + to +
    ':\n  the e-transfer version\n  the card version');
}

// ============================================================ SENDING

function sendDonationFromMenu() {
  const ui = SpreadsheetApp.getUi();
  const pending = dnFindPending();
  if (!pending.length) { ui.alert('Nothing is waiting.'); return; }

  const n = Math.min(pending.length, DN.MAX_PER_RUN);
  const res = ui.alert(
    'Send ' + n + ' email(s)?',
    pending.slice(0, n).map(function (p) {
      return (p.name || '(no name)') + ' <' + p.email + '>  ' + dnMoney(p.amount);
    }).join('\n'),
    ui.ButtonSet.YES_NO
  );
  if (res !== ui.Button.YES) return;
  ui.alert('Sent ' + sendDonationThanks(true) + '.');
}

/**
 * The only function that sends. The 15-minute trigger calls it with no
 * argument.
 * @param {boolean} manual  true when a human confirmed from the menu, which
 *                          bypasses the arming switch but nothing else.
 */
function sendDonationThanks(manual) {
  const props = PropertiesService.getScriptProperties();
  if (!manual && props.getProperty('dn_armed') !== 'yes') return 0;

  const pending = dnFindPending();
  if (!pending.length) return 0;

  if (pending.length > DN.CIRCUIT_BREAKER) {
    props.setProperty('dn_armed', 'no');
    MailApp.sendEmail({
      to: DN.NOTIFY_EMAIL || Session.getEffectiveUser().getEmail(),
      subject: '[ASOSC] DN-02 — Donation thank-yous paused',
      body: pending.length + ' donations are suddenly waiting, which is more ' +
            'than expected.\n\nSending has been turned off so nobody gets emailed ' +
            'by mistake.\nOpen the sheet, check the Thanks Sent column looks ' +
            'right, then turn sending back on.',
    });
    return 0;
  }

  const already = dnSentToday();
  const room = Math.min(DN.MAX_PER_RUN, DN.MAX_PER_DAY - already, MailApp.getRemainingDailyQuota());
  if (room <= 0) return 0;

  const t = dnReadTemplate();
  if (!t.body) return 0;

  const form = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(DN.FORM_TAB);
  const sentCol = dnColumnIndex(form, DN.SENT_COL_HEADER);
  const noteCol = dnColumnIndex(form, DN.NOTE_COL_HEADER);

  const seenThisRun = {};
  let count = 0;

  for (let i = 0; i < pending.length && count < room; i++) {
    const p = pending[i];

    // Two donations from one address in a batch are plausible and both deserve
    // a thank you, so this only guards against the same row being seen twice.
    const key = p.email + '|' + p.entryId;
    if (seenThisRun[key]) continue;

    try {
      const plain = dnRenderBody(t.body, p, t);
      dnSendDonorEmail({
        to: p.email,
        subject: t.subject,
        body: plain,                              // fallback for text-only clients
        htmlBody: buildBrandedEmail(plain, t),
      });
      // Mark immediately, so a crash on the next row cannot cause a resend.
      form.getRange(p.row, sentCol).setValue(new Date());
      seenThisRun[key] = true;
      count++;
    } catch (err) {
      form.getRange(p.row, noteCol).setValue('DN-03 ' + String(err).slice(0, 120));
    }
  }

  props.setProperty('dn_dayKey', dnTodayKey());
  props.setProperty('dn_dayCount', String(already + count));
  return count;
}

// ============================================================ SELECTION

/** Everyone eligible right now. All exclusions live here, in one auditable place. */
function dnFindPending() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const form = ss.getSheetByName(DN.FORM_TAB);
  if (!form || form.getLastRow() < 2) return [];

  const sentCol = dnColumnIndex(form, DN.SENT_COL_HEADER);
  const emailCol = dnColumnIndex(form, DN.COL_EMAIL);
  const nameCol = dnColumnIndex(form, DN.COL_NAME);
  const amountCol = dnColumnIndex(form, DN.COL_AMOUNT);
  const methodCol = dnColumnIndex(form, DN.COL_METHOD);
  const entryCol = dnColumnIndex(form, DN.COL_ENTRY);

  // No email column means the website is not sending donor details yet.
  if (sentCol < 1 || emailCol < 1 || entryCol < 1) return [];

  const watermark = Number(PropertiesService.getScriptProperties().getProperty('dn_watermark') || 0);
  const values = form.getDataRange().getValues();
  const out = [];

  for (let r = 1; r < values.length; r++) {
    const row = values[r];
    const entryId = Number(row[entryCol - 1]);
    const email = String(row[emailCol - 1] || '').trim().toLowerCase();
    const name = nameCol > 0 ? String(row[nameCol - 1] || '').trim() : '';

    if (!email || email.indexOf('@') === -1) continue;   // anonymous donation
    if (row[sentCol - 1]) continue;                       // guard 2

    // Guard 1. A blank or non-numeric Entry ID cannot be compared against the
    // watermark, so it is skipped rather than assumed new.
    if (!Number.isFinite(entryId) || entryId <= 0) continue;
    if (entryId <= watermark) continue;

    out.push({
      row: r + 1,
      entryId: entryId,
      name: name,
      firstName: name ? (name.split(' ')[0] || name) : '',
      email: email,
      amount: amountCol > 0 ? Number(String(row[amountCol - 1]).replace(/[^0-9.]/g, '')) : 0,
      method: methodCol > 0 ? String(row[methodCol - 1] || '').trim() : '',
    });
  }
  return out;
}

// ============================================================ TEMPLATE

function dnReadTemplate() {
  const tab = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(DN.TEMPLATE_TAB);
  if (!tab) return { body: '', subject: '' };
  return {
    body: String(tab.getRange('A1').getValue() || '').trim(),
    subject: String(tab.getRange('B1').getValue() || '').trim() ||
             'Thank you for supporting ASOSC',
    buttonLabel: String(tab.getRange('B2').getValue() || '').trim(),
    buttonUrl: String(tab.getRange('B3').getValue() || '').trim(),
    preheader: String(tab.getRange('B4').getValue() || '').trim(),
    etransferBlock: String(tab.getRange('B5').getValue() || '').trim() || dnDefaultEtransferBlock(),
    cardBlock: String(tab.getRange('B6').getValue() || '').trim() || dnDefaultCardBlock(),
  };
}

function dnRenderBody(template, person, t) {
  const isEtransfer = /transfer|interac|etransfer/i.test(person.method || '');
  const instructions = (isEtransfer ? t.etransferBlock : t.cardBlock) || '';

  return String(template)
    .replace(/\{\{first_name\}\}/g, person.firstName || 'there')
    .replace(/\{\{name\}\}/g, person.name || 'there')
    .replace(/\{\{amount\}\}/g, dnMoney(person.amount))
    .replace(/\{\{method\}\}/g, person.method || 'your chosen method')
    .replace(/\{\{payment_instructions\}\}/g, instructions
      .replace(/\{\{amount\}\}/g, dnMoney(person.amount))
      .replace(/\{\{etransfer_to\}\}/g, DN.ETRANSFER_TO))
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function dnDefaultBody() {
  return [
    'Hi {{first_name}},',
    '',
    'Thank you for choosing to support ASOSC with a gift of {{amount}}.',
    '',
    '{{payment_instructions}}',
    '',
    'Your donation goes straight into the work: cultural celebrations, youth programming, wellness sessions, and community outreach across Strathcona County.',
    '',
    'If you need anything for your records, reply to this email and we will sort it out.',
    '',
    'Busayo Disu',
    'President',
    'Africans Society of Strathcona County',
  ].join('\n');
}

function dnDefaultEtransferBlock() {
  return [
    'To complete your donation, send an Interac e-Transfer of {{amount}} to {{etransfer_to}}.',
    '',
    'Please type the word DONATION in the message field when you send it. That message is how we match your transfer to this form, so we would rather you did not leave it blank.',
  ].join('\n');
}

function dnDefaultCardBlock() {
  return 'We are processing your card payment. Nothing else is needed from you.';
}

// ============================================================ HELPERS

/**
 * Donor-facing mail. MailApp always sends from the script owner; replies go
 * to support@asosc.ca. Do not pass GmailApp `from` unless that address is a
 * Send-mail-as alias on the owner account — otherwise every send throws and
 * nothing goes out.
 */
function dnSendDonorEmail(opts) {
  MailApp.sendEmail({
    to: opts.to,
    subject: opts.subject,
    body: opts.body,
    htmlBody: opts.htmlBody,
    name: DN.FROM_NAME,
    replyTo: DN.REPLY_TO,
  });
}

/** Why each existing row would or would not send. Used when Preview is empty. */
function dnDiagnoseRows() {
  const form = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(DN.FORM_TAB);
  if (!form || form.getLastRow() < 2) {
    return { missing: 'No donation rows yet.', lines: [], watermark: 0 };
  }

  const sentCol = dnColumnIndex(form, DN.SENT_COL_HEADER);
  const emailCol = dnColumnIndex(form, DN.COL_EMAIL);
  const entryCol = dnColumnIndex(form, DN.COL_ENTRY);
  const nameCol = dnColumnIndex(form, DN.COL_NAME);
  const watermark = Number(PropertiesService.getScriptProperties().getProperty('dn_watermark') || 0);

  if (sentCol < 1) {
    return {
      missing: 'Missing a column headed exactly "' + DN.SENT_COL_HEADER +
               '". Use Allow emails for existing rows (or First-time setup once), then try Preview again.',
      lines: [],
      watermark: watermark,
    };
  }
  if (emailCol < 1) {
    return { missing: 'Missing a column headed exactly "' + DN.COL_EMAIL + '".', lines: [], watermark: watermark };
  }
  if (entryCol < 1) {
    return { missing: 'Missing a column headed exactly "' + DN.COL_ENTRY + '".', lines: [], watermark: watermark };
  }

  const values = form.getDataRange().getValues();
  const lines = [];

  for (let r = 1; r < values.length; r++) {
    const row = values[r];
    const entryId = Number(row[entryCol - 1]);
    const email = String(row[emailCol - 1] || '').trim();
    const name = nameCol > 0 ? String(row[nameCol - 1] || '').trim() : '';
    let reason = 'WAITING';

    if (!email || email.indexOf('@') === -1) reason = 'no email — skipped';
    else if (row[sentCol - 1]) reason = 'already marked sent';
    else if (!Number.isFinite(entryId) || entryId <= 0) reason = 'bad Entry ID — skipped';
    else if (entryId <= watermark) reason = 'frozen by setup (ID ' + entryId + ' <= ' + watermark + ')';

    const label = Number.isFinite(entryId) && entryId > 0 ? String(entryId) : '?';
    lines.push('#' + label + '  ' + (name || '(no name)') + '  —  ' + reason);
  }

  return { missing: '', lines: lines, watermark: watermark };
}

function dnMoney(n) {
  const v = Number(n);
  if (!isFinite(v) || v <= 0) return 'your donation';
  return '$' + v.toFixed(2);
}

function dnColumnIndex(sheet, header) {
  const head = sheet.getRange(1, 1, 1, Math.max(sheet.getLastColumn(), 1)).getValues()[0];
  for (let i = 0; i < head.length; i++) {
    if (String(head[i]).trim() === header) return i + 1;
  }
  return -1;
}

function dnMaxEntryId(sheet) {
  if (sheet.getLastRow() < 2) return 0;
  const col = dnColumnIndex(sheet, DN.COL_ENTRY);
  if (col < 1) return 0;
  const ids = sheet.getRange(2, col, sheet.getLastRow() - 1, 1).getValues()
    .map(function (r) { return Number(r[0]); })
    .filter(function (n) { return Number.isFinite(n); });
  return ids.length ? Math.max.apply(null, ids) : 0;
}

function dnTodayKey() {
  return Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');
}

function dnSentToday() {
  const props = PropertiesService.getScriptProperties();
  if (props.getProperty('dn_dayKey') !== dnTodayKey()) return 0;
  return Number(props.getProperty('dn_dayCount') || 0);
}