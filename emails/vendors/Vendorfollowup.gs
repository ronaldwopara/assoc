/**
 * ASOSC — Vendor application acknowledgement + internal notification
 * Add as a NEW file in the vendor project, alongside the existing Code.gs and
 * EmailTemplate.gs. Code.gs needs no changes.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * THE COPY CONSTRAINT THAT MATTERS MOST HERE
 *
 * The form itself says completing it does not guarantee approval. So this
 * email must confirm RECEIPT and nothing more. A vendor who reads it as
 * acceptance may buy stock, book staff, or turn down another market, and then
 * be declined. That is a worse outcome than sending nothing at all.
 *
 * The default wording states plainly that this is not an approval. Keep that
 * line if you rewrite it.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * TWO EMAILS PER APPLICATION
 *
 * 1. Acknowledgement to the applicant.
 * 2. Notification to ASOSC summarising the logistics — booth, electricity,
 *    water, licence, insurance — with Reply-To set to the vendor.
 *
 * The second one exists because a vendor application is an operational
 * document, not a message. Twenty columns in a spreadsheet do not tell Busayo
 * that four vendors need electricity and two have no liability insurance. The
 * summary does, at the moment the application arrives, while there is still
 * time to plan power and chase paperwork.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * COLUMNS ARE RESOLVED BY HEADER NAME
 *
 * This sheet has twenty columns and its questions will be reworded between
 * events. Header lookup uses a distinctive fragment of each question rather
 * than the full string, so light rewording does not silently break anything.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * SAFEGUARDS — same six as the other forms.
 *   1. WATERMARK   Entries existing at install time are permanently excluded.
 *                  Blank or non-numeric Entry IDs are skipped too. Without
 *                  this, installing would email every past applicant that
 *                  their application was received, years late.
 *   2. SENT COLUMN Per-row timestamp. Never sends twice.
 *   3. ARMING      Off until deliberately turned on from the menu.
 *   4. BATCH CAP   5 applications per run (up to 10 emails).
 *   5. DAILY CAP   25 applications per day.
 *   6. CIRCUIT     More than 15 suddenly pending stops everything.
 *
 * There is deliberately no send-to-everyone function in this file.
 */

const VN = {
  FORM_TAB: 'Vendors',
  TEMPLATE_TAB: 'Vendor Reply Email',
  SENT_COL_HEADER: 'Ack Sent',
  NOTE_COL_HEADER: 'Ack Note',

  // Matched as case-insensitive fragments, so rewording the questions between
  // events does not break the lookup.
  FIND: {
    entry: 'entry id',
    name: 'full name',
    business: 'business or organization',
    email: 'email',
    phone: 'phone',
    vendorType: 'what type of vendor',
    products: 'products or services',
    culture: 'african culture or region',
    booth: 'booth/table',
    electricity: 'electricity',
    equipment: 'using any of the following',
    water: 'water',
    licence: 'business license',
    insurance: 'liability insurance',
    comments: 'additional comments',
  },

  MAX_PER_RUN: 5,
  MAX_PER_DAY: 25,
  CIRCUIT_BREAKER: 15,

  NOTIFY_EMAIL: 'support@asosc.ca',
  REPLY_TO: 'support@asosc.ca',
  FROM_EMAIL: 'support@asosc.ca',
  FROM_NAME: 'ASOSC',
};

// ============================================================ MENU

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Vendor replies')
    .addItem('Preview who would get a reply', 'previewVendorAcks')
    .addItem('Send me a test copy', 'sendVendorTestToMe')
    .addSeparator()
    .addItem('Send pending replies now', 'sendVendorFromMenu')
    .addSeparator()
    .addItem('Turn sending ON', 'armVendors')
    .addItem('Turn sending OFF', 'disarmVendors')
    .addItem('Status', 'showVendorStatus')
    .addSeparator()
    .addItem('Allow emails for existing rows', 'includeExistingVendors')
    .addItem('First-time setup', 'setupVendors')
    .addToUi();
}

// ============================================================ SETUP

function setupVendors() {
  const ui = SpreadsheetApp.getUi();
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const form = ss.getSheetByName(VN.FORM_TAB);
  if (!form) { ui.alert('VN-01 — Cannot find the ' + VN.FORM_TAB + ' tab.'); return; }

  vnEnsureTemplateTab(ss);
  vnEnsureTrackingColumns(form);

  const existingMax = vnMaxEntryId(form);
  const props = PropertiesService.getScriptProperties();
  props.setProperty('vn_watermark', String(existingMax));
  props.setProperty('vn_armed', 'no');

  installVendorTrigger();

  ui.alert(
    'Setup done.\n\n' +
    'Entries 1 to ' + existingMax + ' will never be emailed by this script.\n' +
    'Only applications received from now on are eligible.\n\n' +
    'Notifications go to: ' + (VN.NOTIFY_EMAIL || Session.getEffectiveUser().getEmail()) + '\n\n' +
    'Sending is currently OFF. Edit the wording in the "' + VN.TEMPLATE_TAB +
    '" tab, preview it, then turn sending on when you are happy.'
  );
}

function vnEnsureTemplateTab(ss) {
  let tab = ss.getSheetByName(VN.TEMPLATE_TAB);
  if (tab) return tab;

  tab = ss.insertSheet(VN.TEMPLATE_TAB);
  tab.getRange('A1').setValue(vnDefaultBody());
  tab.getRange('B1').setValue('We received your vendor application');
  tab.getRange('B2').setValue('');
  tab.getRange('B3').setValue('');
  tab.getRange('B4').setValue('');

  tab.getRange('A3').setValue('Body in A1. Subject B1. Button label B2, link B3. Preview text B4.');
  tab.getRange('A4').setValue('Placeholders: {{first_name}}, {{name}}, {{business_name}}, {{vendor_type}}');
  tab.getRange('A5').setValue('KEEP the line saying this is not an approval. The form promises that ASOSC contacts selected vendors, and a vendor who reads this as acceptance may spend money before being declined.');
  tab.getRange('A3:A5').setFontStyle('italic').setFontColor('#666666');

  tab.setColumnWidth(1, 620);
  tab.setColumnWidth(2, 340);
  tab.getRange('A1').setWrap(true).setVerticalAlignment('top');
  tab.setRowHeight(1, 300);
  return tab;
}

function vnEnsureTrackingColumns(form) {
  const head = form.getRange(1, 1, 1, Math.max(form.getLastColumn(), 1)).getValues()[0]
    .map(function (h) { return String(h).trim(); });

  [VN.SENT_COL_HEADER, VN.NOTE_COL_HEADER].forEach(function (name) {
    if (head.indexOf(name) === -1) {
      form.getRange(1, form.getLastColumn() + 1).setValue(name).setFontWeight('bold');
    }
  });
}

function installVendorTrigger() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'sendVendorAcks') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('sendVendorAcks').timeBased().everyMinutes(30).create();
}

// ============================================================ ARMING

function armVendors() {
  const ui = SpreadsheetApp.getUi();
  const pending = vnFindPending();
  const res = ui.alert(
    'Turn sending on?',
    pending.length + ' application(s) are waiting for a reply right now.\n\n' +
    'Each sends two emails: an acknowledgement to the vendor and a summary to ' +
    (VN.NOTIFY_EMAIL || Session.getEffectiveUser().getEmail()) + '.\n\n' +
    'Up to ' + VN.MAX_PER_RUN + ' per run, ' + VN.MAX_PER_DAY + ' per day.\n\nContinue?',
    ui.ButtonSet.YES_NO
  );
  if (res !== ui.Button.YES) return;
  PropertiesService.getScriptProperties().setProperty('vn_armed', 'yes');
  ui.alert('Sending is now ON.');
}

function disarmVendors() {
  PropertiesService.getScriptProperties().setProperty('vn_armed', 'no');
  SpreadsheetApp.getUi().alert('Sending is now OFF. Nothing will go out.');
}

function showVendorStatus() {
  const props = PropertiesService.getScriptProperties();
  SpreadsheetApp.getUi().alert(
    'Sending: ' + (props.getProperty('vn_armed') === 'yes' ? 'ON' : 'OFF') + '\n' +
    'Waiting for a reply: ' + vnFindPending().length + '\n' +
    'Handled today: ' + vnSentToday() + ' of ' + VN.MAX_PER_DAY + '\n' +
    'Skipping entries 1 to ' + (props.getProperty('vn_watermark') || '?') + '\n' +
    'Notifications go to: ' + (VN.NOTIFY_EMAIL || Session.getEffectiveUser().getEmail()) + '\n' +
    'Gmail quota left today: ' + MailApp.getRemainingDailyQuota()
  );
}

// ============================================================ PREVIEW / TEST

function previewVendorAcks() {
  const pending = vnFindPending();
  const ui = SpreadsheetApp.getUi();
  if (!pending.length) {
    ui.alert('No applications are waiting for a reply.\n\nIf people are already on the sheet, they may be frozen by setup. Use Allow emails for existing rows.');
    return;
  }

  const lines = pending.slice(0, 20).map(function (p) {
    return '  ' + (p.businessName || p.name) + '  <' + p.email + '>';
  });
  ui.alert(
    pending.length + ' waiting. The next run would handle up to ' + VN.MAX_PER_RUN + ':\n\n' +
    lines.join('\n') + (pending.length > 20 ? '\n  ...and ' + (pending.length - 20) + ' more' : '')
  );
}

function sendVendorTestToMe() {
  const t = vnReadTemplate();
  const to = Session.getEffectiveUser().getEmail();
  const sample = {
    name: 'Sample Vendor', firstName: 'Sample', email: to, phone: '5875551234',
    businessName: 'Mama Ade Kitchen', vendorType: 'Food and drink',
    products: 'West African home cooking, jollof rice, puff puff, chin chin',
    culture: 'Nigerian', booth: 'Yes', electricity: 'Yes', equipment: 'Propane burner',
    water: 'Yes', licence: 'Yes', insurance: 'No',
    comments: 'Would prefer a spot near the entrance if possible.',
    entryId: 0,
  };

  const body = vnRenderBody(t.body, sample);
  vnSendMail({
    to: to,
    subject: '[TEST] ' + t.subject,
    body: body,
    htmlBody: buildBrandedEmail(body, t),
  });

  vnSendNotification(sample, to);
  SpreadsheetApp.getUi().alert('Two test emails sent to ' + to +
    ':\n  the vendor acknowledgement\n  the internal summary');
}

// ============================================================ SENDING

function sendVendorFromMenu() {
  const ui = SpreadsheetApp.getUi();
  const pending = vnFindPending();
  if (!pending.length) { ui.alert('Nothing is waiting.'); return; }

  const n = Math.min(pending.length, VN.MAX_PER_RUN);
  const res = ui.alert(
    'Reply to ' + n + ' application(s)?',
    pending.slice(0, n).map(function (p) {
      return (p.businessName || p.name) + ' <' + p.email + '>';
    }).join('\n'),
    ui.ButtonSet.YES_NO
  );
  if (res !== ui.Button.YES) return;
  ui.alert('Handled ' + sendVendorAcks(true) + '.');
}

/**
 * The only function that sends. The 30-minute trigger calls it with no
 * argument.
 * @param {boolean} manual  true when a human confirmed from the menu, which
 *                          bypasses the arming switch but nothing else.
 */
function sendVendorAcks(manual) {
  const props = PropertiesService.getScriptProperties();
  if (!manual && props.getProperty('vn_armed') !== 'yes') return 0;

  const pending = vnFindPending();
  if (!pending.length) return 0;

  if (pending.length > VN.CIRCUIT_BREAKER) {
    props.setProperty('vn_armed', 'no');
    MailApp.sendEmail({
      to: VN.NOTIFY_EMAIL || Session.getEffectiveUser().getEmail(),
      subject: '[ASOSC] VN-02 — Vendor replies paused',
      body: pending.length + ' vendor applications are suddenly waiting, which ' +
            'is more than expected.\n\nSending has been turned off so nobody ' +
            'gets emailed by mistake.\nOpen the sheet, check the Ack Sent ' +
            'column looks right, then turn sending back on.',
    });
    return 0;
  }

  const already = vnSentToday();
  // Two emails per application, so the quota check halves.
  const quotaRoom = Math.floor(MailApp.getRemainingDailyQuota() / 2);
  const room = Math.min(VN.MAX_PER_RUN, VN.MAX_PER_DAY - already, quotaRoom);
  if (room <= 0) return 0;

  const t = vnReadTemplate();
  if (!t.body) return 0;

  const form = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(VN.FORM_TAB);
  const sentCol = vnColumnIndex(form, VN.SENT_COL_HEADER);
  const noteCol = vnColumnIndex(form, VN.NOTE_COL_HEADER);
  const notifyTo = VN.NOTIFY_EMAIL || Session.getEffectiveUser().getEmail();

  const seenThisRun = {};
  let count = 0;

  for (let i = 0; i < pending.length && count < room; i++) {
    const p = pending[i];

    if (seenThisRun[p.email]) {
      form.getRange(p.row, noteCol).setValue('Skipped, duplicate address in this batch');
      form.getRange(p.row, sentCol).setValue(new Date());
      continue;
    }

    const problems = [];

    // Summary first. If only one email gets out, the one that puts the booth
    // and power requirements in front of a human is worth more.
    try {
      vnSendNotification(p, notifyTo);
    } catch (err) {
      problems.push('VN-04 notify: ' + String(err).slice(0, 80));
    }

    try {
      const plain = vnRenderBody(t.body, p);
      vnSendMail({
        to: p.email,
        subject: t.subject,
        body: plain,                              // fallback for text-only clients
        htmlBody: buildBrandedEmail(plain, t),
      });
    } catch (err) {
      problems.push('VN-03 reply: ' + String(err).slice(0, 80));
    }

    // Marked either way. Retrying would re-notify about an application already
    // seen, which is worse than one missing acknowledgement.
    form.getRange(p.row, sentCol).setValue(new Date());
    if (problems.length) form.getRange(p.row, noteCol).setValue(problems.join(' | '));
    seenThisRun[p.email] = true;
    count++;
  }

  props.setProperty('vn_dayKey', vnTodayKey());
  props.setProperty('vn_dayCount', String(already + count));
  return count;
}

/**
 * Internal summary. Plain text, because it is a working document Busayo will
 * forward and reply from, not a branded one.
 *
 * Missing licence or insurance is called out explicitly rather than left as a
 * quiet "No" in a list. Those are the two answers that block approval, and
 * they are the ones worth chasing early.
 */
function vnSendNotification(p, notifyTo) {
  const flags = [];
  if (/^no$/i.test(p.licence)) flags.push('NO BUSINESS LICENCE');
  if (/^no$/i.test(p.insurance)) flags.push('NO LIABILITY INSURANCE');

  const lines = [
    'New vendor application.',
    '',
    'Business:   ' + (p.businessName || '(not given)'),
    'Contact:    ' + p.name,
    'Email:      ' + p.email,
    'Phone:      ' + (p.phone ? vnFormatPhone(p.phone) : 'not given'),
    'Entry:      #' + p.entryId,
    '',
    flags.length ? '!! ' + flags.join('  |  ') + '\n' : '',
    'Type:       ' + (p.vendorType || '-'),
    'Sells:      ' + (p.products || '-'),
    'Culture:    ' + (p.culture || '-'),
    '',
    'ON-SITE REQUIREMENTS',
    '  Booth/table from ASOSC:  ' + (p.booth || '-'),
    '  Electricity:             ' + (p.electricity || '-'),
    '  Water:                   ' + (p.water || '-'),
    '  Equipment at booth:      ' + (p.equipment || '-'),
    '',
    'PAPERWORK',
    '  Business licence:        ' + (p.licence || '-'),
    '  Liability insurance:     ' + (p.insurance || '-'),
    '',
    p.comments ? 'THEIR NOTES\n  ' + p.comments + '\n' : '',
    'Reply to this email and it goes straight to ' + p.name + '.',
    '',
    'Sheet: ' + SpreadsheetApp.getActiveSpreadsheet().getUrl(),
  ];

  MailApp.sendEmail({
    to: notifyTo,
    subject: 'Vendor application: ' + (p.businessName || p.name) +
             (flags.length ? ' [' + flags.length + ' flag' + (flags.length > 1 ? 's' : '') + ']' : ''),
    body: lines.filter(function (l) { return l !== ''; }).join('\n'),
    name: 'ASOSC website',
    replyTo: p.email,
  });
}

// ============================================================ SELECTION

/** Everyone eligible right now. All exclusions live here, in one auditable place. */
function vnFindPending() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const form = ss.getSheetByName(VN.FORM_TAB);
  if (!form || form.getLastRow() < 2) return [];

  const sentCol = vnColumnIndex(form, VN.SENT_COL_HEADER);
  if (sentCol < 1) return [];

  const c = vnResolveColumns(form);
  if (c.email < 1 || c.entry < 1) return [];

  const watermark = Number(PropertiesService.getScriptProperties().getProperty('vn_watermark') || 0);
  const values = form.getDataRange().getValues();
  const out = [];

  const at = function (row, col) { return col > 0 ? String(row[col - 1] || '').trim() : ''; };

  for (let r = 1; r < values.length; r++) {
    const row = values[r];
    const entryId = Number(row[c.entry - 1]);
    const email = at(row, c.email).toLowerCase();
    const name = at(row, c.name);

    if (!email || email.indexOf('@') === -1) continue;   // no address
    if (row[sentCol - 1]) continue;                       // guard 2

    // Guard 1. A blank or non-numeric Entry ID cannot be compared against the
    // watermark, so it is skipped rather than assumed new.
    if (!Number.isFinite(entryId) || entryId <= 0) continue;
    if (entryId <= watermark) continue;

    out.push({
      row: r + 1,
      entryId: entryId,
      name: name,
      firstName: name.split(' ')[0] || name,
      email: email,
      phone: at(row, c.phone),
      businessName: at(row, c.business),
      vendorType: at(row, c.vendorType),
      products: at(row, c.products),
      culture: at(row, c.culture),
      booth: at(row, c.booth),
      electricity: at(row, c.electricity),
      equipment: at(row, c.equipment),
      water: at(row, c.water),
      licence: at(row, c.licence),
      insurance: at(row, c.insurance),
      comments: at(row, c.comments),
    });
  }
  return out;
}

/** Fragment matching, so light rewording of the questions does not break this. */
function vnResolveColumns(sheet) {
  const head = sheet.getRange(1, 1, 1, Math.max(sheet.getLastColumn(), 1)).getValues()[0]
    .map(function (h) { return String(h).trim().toLowerCase(); });

  const find = function (fragment) {
    for (let i = 0; i < head.length; i++) {
      if (head[i].indexOf(fragment) !== -1) return i + 1;
    }
    return -1;
  };

  const cols = {};
  Object.keys(VN.FIND).forEach(function (k) { cols[k] = find(VN.FIND[k]); });

  // "email" also appears inside longer headers; the vendor sheet's own address
  // column is "Email Address", so prefer that when both are present.
  const exact = head.indexOf('email address');
  if (exact !== -1) cols.email = exact + 1;

  return cols;
}

// ============================================================ TEMPLATE

function vnReadTemplate() {
  const tab = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(VN.TEMPLATE_TAB);
  if (!tab) return { body: '', subject: '' };
  return {
    body: String(tab.getRange('A1').getValue() || '').trim(),
    subject: String(tab.getRange('B1').getValue() || '').trim() ||
             'We received your vendor application',
    buttonLabel: String(tab.getRange('B2').getValue() || '').trim(),
    buttonUrl: String(tab.getRange('B3').getValue() || '').trim(),
    preheader: String(tab.getRange('B4').getValue() || '').trim(),
  };
}

function vnRenderBody(template, person) {
  // Business name is optional on the form. Falling back to their own name keeps
  // the sentence readable instead of leaving a gap.
  const label = person.businessName || person.name || 'your application';

  return String(template)
    .replace(/\{\{first_name\}\}/g, person.firstName || 'there')
    .replace(/\{\{name\}\}/g, person.name || 'there')
    .replace(/\{\{business_name\}\}/g, label)
    .replace(/\{\{vendor_type\}\}/g, person.vendorType || 'your category')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function vnDefaultBody() {
  return [
    'Hi {{first_name}},',
    '',
    'Thanks for applying to be a vendor with ASOSC. We have your application for {{business_name}}.',
    '',
    'To be clear about where this stands: it confirms we received your form, it is not an approval. We go through every application and get in touch with selected vendors about next steps, including booth details, timing, and what to bring on the day.',
    '',
    'You will hear from us either way. If the event is getting close and you have not heard anything, reply to this email and we will look into it.',
    '',
    'Busayo Disu',
    'President',
    'Africans Society of Strathcona County',
  ].join('\n');
}

// ============================================================ HELPERS

function vnSendMail(opts) {
  MailApp.sendEmail({
    to: opts.to,
    subject: opts.subject,
    body: opts.body,
    htmlBody: opts.htmlBody,
    name: VN.FROM_NAME,
    replyTo: opts.replyTo || VN.REPLY_TO,
  });
}

function includeExistingVendors() {
  const ui = SpreadsheetApp.getUi();
  const form = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(VN.FORM_TAB);
  if (!form) { ui.alert('VN-01 — Cannot find the ' + VN.FORM_TAB + ' tab.'); return; }
  const res = ui.alert(
    'Allow emails for rows that already exist?',
    'This unfreezes applications that were on the sheet before First-time setup. Rows already marked sent stay skipped.\n\nContinue?',
    ui.ButtonSet.YES_NO
  );
  if (res !== ui.Button.YES) return;
  vnEnsureTrackingColumns(form);
  PropertiesService.getScriptProperties().setProperty('vn_watermark', '0');
  ui.alert(
    'Existing rows can now be emailed.\n\nWaiting: ' + vnFindPending().length +
    '.\nNext: Preview, then Send pending replies now.\nDo not run First-time setup again.'
  );
}

function vnFormatPhone(digits) {
  const d = String(digits).replace(/\D/g, '');
  if (d.length === 10) return '(' + d.slice(0, 3) + ') ' + d.slice(3, 6) + '-' + d.slice(6);
  if (d.length === 11 && d[0] === '1') return '(' + d.slice(1, 4) + ') ' + d.slice(4, 7) + '-' + d.slice(7);
  return d;
}

function vnColumnIndex(sheet, header) {
  const head = sheet.getRange(1, 1, 1, Math.max(sheet.getLastColumn(), 1)).getValues()[0];
  for (let i = 0; i < head.length; i++) {
    if (String(head[i]).trim() === header) return i + 1;
  }
  return -1;
}

function vnMaxEntryId(sheet) {
  if (sheet.getLastRow() < 2) return 0;
  const ids = sheet.getRange(2, 1, sheet.getLastRow() - 1, 1).getValues()
    .map(function (r) { return Number(r[0]); })
    .filter(function (n) { return Number.isFinite(n); });
  return ids.length ? Math.max.apply(null, ids) : 0;
}

function vnTodayKey() {
  return Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');
}

function vnSentToday() {
  const props = PropertiesService.getScriptProperties();
  if (props.getProperty('vn_dayKey') !== vnTodayKey()) return 0;
  return Number(props.getProperty('vn_dayCount') || 0);
}