/**
 * ASOSC — Contact form auto-reply + internal notification
 * Add as a NEW file in the contact form's Apps Script project, alongside the
 * existing Code.gs and EmailTemplate.gs. Do not replace Code.gs — nothing in
 * it needs to change for contact, since there is no unsubscribe here.
 *
 * Sheet layout expected (from the existing form handler):
 *   A  Entry ID
 *   B  Name
 *   C  Email
 *   D  Phone (Optional)
 *   E  Comment or Message
 *   ...then two columns this script adds: Reply Sent, Reply Note
 *
 * ─────────────────────────────────────────────────────────────────────────
 * TWO EMAILS PER SUBMISSION
 *
 * 1. An acknowledgement to the person, so they know it arrived.
 * 2. A notification to ASOSC with the full message, Reply-To set to the
 *    sender's address.
 *
 * The second one is the point. A contact form that only writes to a sheet is a
 * form nobody reads — messages sit unnoticed for weeks and the sender concludes
 * ASOSC ignored them. With Reply-To set, Busayo hits reply in her inbox and the
 * response goes straight to the person. She never opens the spreadsheet.
 *
 * No unsubscribe link: this is a direct reply to something they sent, which is
 * transactional rather than commercial.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * SAFEGUARDS — same six as the other forms.
 *   1. WATERMARK   Entries existing at install time are permanently excluded.
 *                  Blank or non-numeric Entry IDs are skipped too, since an ID
 *                  that cannot be compared must not be assumed new. Without
 *                  this, installing would fire a notification for every
 *                  historical message at once.
 *   2. SENT COLUMN Per-row timestamp. Never sends twice.
 *   3. ARMING      Off until deliberately turned on from the menu.
 *   4. BATCH CAP   5 submissions per run (up to 10 emails).
 *   5. DAILY CAP   25 submissions per day.
 *   6. CIRCUIT     More than 15 suddenly pending stops everything.
 *
 * There is deliberately no send-to-everyone function in this file.
 */

const CT = {
  FORM_TAB: 'Sheet1',
  TEMPLATE_TAB: 'Reply Email',
  SENT_COL_HEADER: 'Reply Sent',
  NOTE_COL_HEADER: 'Reply Note',

  MAX_PER_RUN: 5,
  MAX_PER_DAY: 25,
  CIRCUIT_BREAKER: 15,

  NOTIFY_EMAIL: '',        // blank = the account running the script
  REPLY_TO: '',            // blank = the account running the script
  FROM_NAME: 'ASOSC',

  ECHO_LIMIT: 600,         // chars of their message quoted back to them
};

// ============================================================ MENU

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Contact replies')
    .addItem('Preview who would get a reply', 'previewContactReplies')
    .addItem('Send me a test copy', 'sendContactTestToMe')
    .addSeparator()
    .addItem('Send pending replies now', 'sendContactFromMenu')
    .addSeparator()
    .addItem('Turn sending ON', 'armContact')
    .addItem('Turn sending OFF', 'disarmContact')
    .addItem('Status', 'showContactStatus')
    .addSeparator()
    .addItem('First-time setup', 'setupContact')
    .addToUi();
}

// ============================================================ SETUP

function setupContact() {
  const ui = SpreadsheetApp.getUi();
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const form = ss.getSheetByName(CT.FORM_TAB);
  if (!form) { ui.alert('CT-01 — Cannot find the ' + CT.FORM_TAB + ' tab.'); return; }

  ctEnsureTemplateTab(ss);
  ctEnsureTrackingColumns(form);

  const existingMax = ctMaxEntryId(form);
  const props = PropertiesService.getScriptProperties();
  props.setProperty('ct_watermark', String(existingMax));
  props.setProperty('ct_armed', 'no');

  installContactTrigger();

  ui.alert(
    'Setup done.\n\n' +
    'Entries 1 to ' + existingMax + ' will never be emailed by this script.\n' +
    'Only messages received from now on are eligible.\n\n' +
    'Notifications go to: ' + (CT.NOTIFY_EMAIL || Session.getEffectiveUser().getEmail()) + '\n\n' +
    'Sending is currently OFF. Edit the wording in the "' + CT.TEMPLATE_TAB +
    '" tab, preview it, then turn sending on when you are happy.'
  );
}

function ctEnsureTemplateTab(ss) {
  let tab = ss.getSheetByName(CT.TEMPLATE_TAB);
  if (tab) return tab;

  tab = ss.insertSheet(CT.TEMPLATE_TAB);
  tab.getRange('A1').setValue(ctDefaultBody());
  tab.getRange('B1').setValue('We got your message');
  tab.getRange('B2').setValue('');
  tab.getRange('B3').setValue('');
  tab.getRange('B4').setValue('');

  tab.getRange('A3').setValue('Body in A1. Subject in B1. Button label B2, button link B3. Preview text B4.');
  tab.getRange('A4').setValue('You can use {{first_name}}, {{name}} and {{message}} anywhere in the body.');
  tab.getRange('A5').setValue('Keep {{message}} away from the last paragraph. A short message with no full stop at the end can otherwise be mistaken for part of the sign-off.');
  tab.getRange('A3:A5').setFontStyle('italic').setFontColor('#666666');

  tab.setColumnWidth(1, 620);
  tab.setColumnWidth(2, 340);
  tab.getRange('A1').setWrap(true).setVerticalAlignment('top');
  tab.setRowHeight(1, 300);
  return tab;
}

function ctEnsureTrackingColumns(form) {
  const head = form.getRange(1, 1, 1, Math.max(form.getLastColumn(), 1)).getValues()[0]
    .map(function (h) { return String(h).trim(); });

  [CT.SENT_COL_HEADER, CT.NOTE_COL_HEADER].forEach(function (name) {
    if (head.indexOf(name) === -1) {
      form.getRange(1, form.getLastColumn() + 1).setValue(name).setFontWeight('bold');
    }
  });
}

function installContactTrigger() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'sendContactReplies') ScriptApp.deleteTrigger(t);
  });
  // Every 15 minutes. Someone writing in expects a faster acknowledgement than
  // a newsletter subscriber, and this also gets the message in front of Busayo
  // while it is still fresh.
  ScriptApp.newTrigger('sendContactReplies').timeBased().everyMinutes(15).create();
}

// ============================================================ ARMING

function armContact() {
  const ui = SpreadsheetApp.getUi();
  const pending = ctFindPending();
  const res = ui.alert(
    'Turn sending on?',
    pending.length + ' message(s) are waiting for a reply right now.\n\n' +
    'Each one sends two emails: an acknowledgement to the sender and a ' +
    'notification to ' + (CT.NOTIFY_EMAIL || Session.getEffectiveUser().getEmail()) + '.\n\n' +
    'Up to ' + CT.MAX_PER_RUN + ' per run, ' + CT.MAX_PER_DAY + ' per day.\n\nContinue?',
    ui.ButtonSet.YES_NO
  );
  if (res !== ui.Button.YES) return;
  PropertiesService.getScriptProperties().setProperty('ct_armed', 'yes');
  ui.alert('Sending is now ON.');
}

function disarmContact() {
  PropertiesService.getScriptProperties().setProperty('ct_armed', 'no');
  SpreadsheetApp.getUi().alert('Sending is now OFF. Nothing will go out.');
}

function showContactStatus() {
  const props = PropertiesService.getScriptProperties();
  SpreadsheetApp.getUi().alert(
    'Sending: ' + (props.getProperty('ct_armed') === 'yes' ? 'ON' : 'OFF') + '\n' +
    'Waiting for a reply: ' + ctFindPending().length + '\n' +
    'Handled today: ' + ctSentToday() + ' of ' + CT.MAX_PER_DAY + '\n' +
    'Skipping entries 1 to ' + (props.getProperty('ct_watermark') || '?') + '\n' +
    'Notifications go to: ' + (CT.NOTIFY_EMAIL || Session.getEffectiveUser().getEmail()) + '\n' +
    'Gmail quota left today: ' + MailApp.getRemainingDailyQuota()
  );
}

// ============================================================ PREVIEW / TEST

function previewContactReplies() {
  const pending = ctFindPending();
  const ui = SpreadsheetApp.getUi();
  if (!pending.length) { ui.alert('No messages are waiting for a reply.'); return; }

  const lines = pending.slice(0, 20).map(function (p) {
    return '  ' + p.name + '  <' + p.email + '>';
  });
  ui.alert(
    pending.length + ' waiting. The next run would handle up to ' + CT.MAX_PER_RUN + ':\n\n' +
    lines.join('\n') + (pending.length > 20 ? '\n  ...and ' + (pending.length - 20) + ' more' : '')
  );
}

/** Sends both emails to whoever is running the script, so you see each one. */
function sendContactTestToMe() {
  const t = ctReadTemplate();
  const to = Session.getEffectiveUser().getEmail();
  const sample = {
    name: 'Sample Sender',
    firstName: 'Sample',
    email: to,
    phone: '5875551234',
    message: 'Hi, I run a small catering business in Sherwood Park and would love to ' +
             'find out about being a vendor at the African Festival this August. ' +
             'Who should I talk to?',
    entryId: 0,
  };

  const body = ctRenderBody(t.body, sample);
  MailApp.sendEmail({
    to: to,
    subject: '[TEST] ' + t.subject,
    body: body,
    htmlBody: buildBrandedEmail(body, t),
    name: CT.FROM_NAME,
    replyTo: CT.REPLY_TO || to,
  });

  ctSendNotification(sample, to);
  SpreadsheetApp.getUi().alert('Two test emails sent to ' + to +
    ':\n  the acknowledgement\n  the internal notification');
}

// ============================================================ SENDING

function sendContactFromMenu() {
  const ui = SpreadsheetApp.getUi();
  const pending = ctFindPending();
  if (!pending.length) { ui.alert('Nothing is waiting.'); return; }

  const n = Math.min(pending.length, CT.MAX_PER_RUN);
  const res = ui.alert(
    'Reply to ' + n + ' message(s)?',
    pending.slice(0, n).map(function (p) { return p.name + ' <' + p.email + '>'; }).join('\n'),
    ui.ButtonSet.YES_NO
  );
  if (res !== ui.Button.YES) return;
  ui.alert('Handled ' + sendContactReplies(true) + '.');
}

/**
 * The only function that sends. The 15-minute trigger calls it with no
 * argument.
 * @param {boolean} manual  true when a human confirmed from the menu, which
 *                          bypasses the arming switch but nothing else.
 */
function sendContactReplies(manual) {
  const props = PropertiesService.getScriptProperties();
  if (!manual && props.getProperty('ct_armed') !== 'yes') return 0;

  const pending = ctFindPending();
  if (!pending.length) return 0;

  if (pending.length > CT.CIRCUIT_BREAKER) {
    props.setProperty('ct_armed', 'no');
    MailApp.sendEmail({
      to: CT.NOTIFY_EMAIL || Session.getEffectiveUser().getEmail(),
      subject: '[ASOSC] CT-02 — Contact replies paused',
      body: pending.length + ' contact messages are suddenly waiting, which is ' +
            'more than expected.\n\nSending has been turned off so nobody gets ' +
            'emailed by mistake.\nOpen the sheet, check the Reply Sent column ' +
            'looks right, then turn sending back on.',
    });
    return 0;
  }

  const already = ctSentToday();
  // Two emails per submission, so the quota check halves.
  const quotaRoom = Math.floor(MailApp.getRemainingDailyQuota() / 2);
  const room = Math.min(CT.MAX_PER_RUN, CT.MAX_PER_DAY - already, quotaRoom);
  if (room <= 0) return 0;

  const t = ctReadTemplate();
  if (!t.body) return 0;

  const form = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CT.FORM_TAB);
  const sentCol = ctColumnIndex(form, CT.SENT_COL_HEADER);
  const noteCol = ctColumnIndex(form, CT.NOTE_COL_HEADER);
  const notifyTo = CT.NOTIFY_EMAIL || Session.getEffectiveUser().getEmail();

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

    // Notification first. If only one of the two can go out, the one that
    // matters is the one that gets a human to actually read the message.
    try {
      ctSendNotification(p, notifyTo);
    } catch (err) {
      problems.push('CT-04 notify: ' + String(err).slice(0, 80));
    }

    try {
      const plain = ctRenderBody(t.body, p);
      MailApp.sendEmail({
        to: p.email,
        subject: t.subject,
        body: plain,                              // fallback for text-only clients
        htmlBody: buildBrandedEmail(plain, t),
        name: CT.FROM_NAME,
        replyTo: CT.REPLY_TO || notifyTo,
      });
    } catch (err) {
      problems.push('CT-03 reply: ' + String(err).slice(0, 80));
    }

    // Mark handled either way. A retry would re-notify Busayo about a message
    // she has already seen, which is worse than one missing acknowledgement.
    form.getRange(p.row, sentCol).setValue(new Date());
    if (problems.length) form.getRange(p.row, noteCol).setValue(problems.join(' | '));
    seenThisRun[p.email] = true;
    count++;
  }

  props.setProperty('ct_dayKey', ctTodayKey());
  props.setProperty('ct_dayCount', String(already + count));
  return count;
}

/**
 * Internal notification. Plain text on purpose — it is a working email, not a
 * branded one, and plain text quotes cleanly when Busayo replies.
 *
 * Reply-To is the sender's address, so replying from her inbox goes straight
 * to them with no copy-pasting and no spreadsheet.
 */
function ctSendNotification(p, notifyTo) {
  const lines = [
    'New contact form message.',
    '',
    'From:    ' + p.name,
    'Email:   ' + p.email,
    'Phone:   ' + (p.phone ? ctFormatPhone(p.phone) : 'not given'),
    'Entry:   #' + p.entryId,
    '',
    '-----------------------------------------',
    p.message,
    '-----------------------------------------',
    '',
    'Reply to this email and it goes straight to ' + p.name + '.',
    '',
    'Sheet: ' + SpreadsheetApp.getActiveSpreadsheet().getUrl(),
  ];

  MailApp.sendEmail({
    to: notifyTo,
    subject: 'Contact form: ' + p.name + ' — ' + ctSubjectSnippet(p.message),
    body: lines.join('\n'),
    name: 'ASOSC website',
    replyTo: p.email,
  });
}

// ============================================================ SELECTION

/** Everyone eligible right now. All exclusions live here, in one auditable place. */
function ctFindPending() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const form = ss.getSheetByName(CT.FORM_TAB);
  if (!form || form.getLastRow() < 2) return [];

  const sentCol = ctColumnIndex(form, CT.SENT_COL_HEADER);
  if (sentCol < 1) return [];

  const watermark = Number(PropertiesService.getScriptProperties().getProperty('ct_watermark') || 0);
  const values = form.getDataRange().getValues();
  const out = [];

  for (let r = 1; r < values.length; r++) {
    const row = values[r];
    const entryId = Number(row[0]);
    const name = String(row[1] || '').trim();
    const email = String(row[2] || '').trim().toLowerCase();

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
      phone: String(row[3] || '').trim(),
      message: String(row[4] || '').trim(),
    });
  }
  return out;
}

// ============================================================ TEMPLATE

function ctReadTemplate() {
  const tab = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CT.TEMPLATE_TAB);
  if (!tab) return { body: '', subject: '' };
  return {
    body: String(tab.getRange('A1').getValue() || '').trim(),
    subject: String(tab.getRange('B1').getValue() || '').trim() || 'We got your message',
    buttonLabel: String(tab.getRange('B2').getValue() || '').trim(),
    buttonUrl: String(tab.getRange('B3').getValue() || '').trim(),
    preheader: String(tab.getRange('B4').getValue() || '').trim(),
  };
}

function ctRenderBody(template, person) {
  return String(template)
    .replace(/\{\{first_name\}\}/g, person.firstName || 'there')
    .replace(/\{\{name\}\}/g, person.name || 'there')
    .replace(/\{\{message\}\}/g, ctEcho(person.message))
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** Their own words, quoted back, trimmed if very long. */
function ctEcho(message) {
  const m = String(message || '').trim();
  if (!m) return '(no message)';
  return m.length <= CT.ECHO_LIMIT ? m : m.slice(0, CT.ECHO_LIMIT).trim() + '...';
}

function ctDefaultBody() {
  return [
    'Hi {{first_name}},',
    '',
    'Thanks for getting in touch with ASOSC. Your message came through and we have it.',
    '',
    'This is what you sent us:',
    '',
    '{{message}}',
    '',
    'Someone will get back to you within a few business days. If it is time sensitive, like an event happening this week, reply to this email and say so and we will move it up the queue.',
    '',
    'Busayo Disu',
    'President',
    'Africans Society of Strathcona County',
  ].join('\n');
}

// ============================================================ HELPERS

function ctSubjectSnippet(message) {
  const m = String(message || '').replace(/\s+/g, ' ').trim();
  if (!m) return 'no message';
  return m.length <= 60 ? m : m.slice(0, 60).trim() + '...';
}

function ctFormatPhone(digits) {
  const d = String(digits).replace(/\D/g, '');
  if (d.length === 10) return '(' + d.slice(0, 3) + ') ' + d.slice(3, 6) + '-' + d.slice(6);
  if (d.length === 11 && d[0] === '1') return '(' + d.slice(1, 4) + ') ' + d.slice(4, 7) + '-' + d.slice(7);
  return d;
}

function ctColumnIndex(sheet, header) {
  const head = sheet.getRange(1, 1, 1, Math.max(sheet.getLastColumn(), 1)).getValues()[0];
  for (let i = 0; i < head.length; i++) {
    if (String(head[i]).trim() === header) return i + 1;
  }
  return -1;
}

function ctMaxEntryId(sheet) {
  if (sheet.getLastRow() < 2) return 0;
  const ids = sheet.getRange(2, 1, sheet.getLastRow() - 1, 1).getValues()
    .map(function (r) { return Number(r[0]); })
    .filter(function (n) { return Number.isFinite(n); });
  return ids.length ? Math.max.apply(null, ids) : 0;
}

function ctTodayKey() {
  return Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');
}

function ctSentToday() {
  const props = PropertiesService.getScriptProperties();
  if (props.getProperty('ct_dayKey') !== ctTodayKey()) return 0;
  return Number(props.getProperty('ct_dayCount') || 0);
}