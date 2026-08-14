/**
 * ASOSC — Volunteer follow-up emails
 * Add-on for the volunteer form Apps Script. Paste as a second file in the
 * same project as the doPost code.
 *
 * The email body lives in cell A1 of a tab called "Follow-up Email" so Busayo
 * can rewrite it without touching code. Subject is in B1.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * WHY SO MANY GUARDS
 *
 * The realistic accident is not a runaway loop. It is installing this on a
 * sheet that already holds 200 volunteers, the script seeing 200 rows with no
 * "sent" marker, and mailing all of them at once. That is unrecoverable: you
 * cannot unsend, and ASOSC's reputation with its volunteers is the asset.
 *
 * So there are six independent guards. Any one of them alone would stop the
 * disaster; all six mean a single mistake cannot cause it.
 *
 *   1. WATERMARK   Entries that existed at install time are permanently
 *                  excluded. This is the one that matters most.
 *   2. SENT COLUMN A per-row timestamp. Never sends twice to the same row.
 *   3. ARMING      Sending is off until someone deliberately turns it on
 *                  from the menu. Fresh installs cannot send.
 *   4. BATCH CAP   At most 5 per run.
 *   5. DAILY CAP   At most 25 per day, counted in script properties.
 *   6. CIRCUIT     If more than 15 people are suddenly pending, something is
 *                  wrong. The script refuses to send and emails Busayo.
 *
 * There is deliberately no "send to everyone" function anywhere in this file.
 * ─────────────────────────────────────────────────────────────────────────
 */

const FU = {
  FORM_TAB: 'Sheet1',
  TEMPLATE_TAB: 'Follow-up Email',
  SENT_COL_HEADER: 'Follow-up Sent',
  NOTE_COL_HEADER: 'Follow-up Note',

  MAX_PER_RUN: 5,
  MAX_PER_DAY: 25,
  CIRCUIT_BREAKER: 15,     // pending count above which we stop and ask a human

  REPLY_TO: '',            // blank = the account running the script
  FROM_NAME: 'ASOSC',
};

// ============================================================ MENU

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Volunteer follow-ups')
    .addItem('Preview who would get an email', 'previewFollowUps')
    .addItem('Send me a test copy', 'sendFollowUpTestToMe')
    .addSeparator()
    .addItem('Send pending follow-ups now', 'sendFollowUpsFromMenu')
    .addSeparator()
    .addItem('Turn sending ON', 'armFollowUps')
    .addItem('Turn sending OFF', 'disarmFollowUps')
    .addItem('Status', 'showFollowUpStatus')
    .addSeparator()
    .addItem('First-time setup', 'setupFollowUps')
    .addToUi();
}

// ============================================================ SETUP

/**
 * Run once. Creates the template tab, adds the tracking columns, and sets the
 * watermark so nobody already in the sheet can ever be emailed by this script.
 */
function setupFollowUps() {
  const ui = SpreadsheetApp.getUi();
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const form = ss.getSheetByName(FU.FORM_TAB);
  if (!form) { ui.alert('VF-01 — Cannot find the ' + FU.FORM_TAB + ' tab.'); return; }

  ensureTemplateTab(ss);
  ensureTrackingColumns(form);

  const existingMax = maxEntryId(form);
  const props = PropertiesService.getScriptProperties();
  props.setProperty('fu_watermark', String(existingMax));
  props.setProperty('fu_armed', 'no');

  installFollowUpTrigger();

  ui.alert(
    'Setup done.\n\n' +
    'Entries 1 to ' + existingMax + ' will never be emailed by this script.\n' +
    'Only people who sign up from now on are eligible.\n\n' +
    'Sending is currently OFF. Edit the wording in the "' + FU.TEMPLATE_TAB +
    '" tab, preview it, then turn sending on when you are happy.'
  );
}

function ensureTemplateTab(ss) {
  let tab = ss.getSheetByName(FU.TEMPLATE_TAB);
  if (tab) return tab;

  tab = ss.insertSheet(FU.TEMPLATE_TAB);
  tab.getRange('A1').setValue(defaultBody());
  tab.getRange('B1').setValue('Thanks for signing up to volunteer with ASOSC');

  tab.getRange('B2').setValue('');
  tab.getRange('B3').setValue('');
  tab.getRange('B4').setValue('');

  tab.getRange('A3').setValue('Body goes in A1. Subject in B1. Button label in B2, button link in B3. Preview text in B4.');
  tab.getRange('A4').setValue('You can use {{first_name}}, {{name}}, and {{interests}} anywhere in the body.');
  tab.getRange('A5').setValue('If someone left their interests blank, any line containing {{interests}} is skipped.');
  tab.getRange('A3:A5').setFontStyle('italic').setFontColor('#666666');

  tab.setColumnWidth(1, 620);
  tab.setColumnWidth(2, 340);
  tab.getRange('A1').setWrap(true).setVerticalAlignment('top');
  tab.setRowHeight(1, 300);
  return tab;
}

function ensureTrackingColumns(form) {
  const head = form.getRange(1, 1, 1, Math.max(form.getLastColumn(), 1)).getValues()[0]
    .map(function (h) { return String(h).trim(); });

  [FU.SENT_COL_HEADER, FU.NOTE_COL_HEADER].forEach(function (name) {
    if (head.indexOf(name) === -1) {
      form.getRange(1, form.getLastColumn() + 1).setValue(name).setFontWeight('bold');
    }
  });
}

function installFollowUpTrigger() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'sendVolunteerFollowUps') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('sendVolunteerFollowUps').timeBased().everyHours(1).create();
}

// ============================================================ ARMING

function armFollowUps() {
  const ui = SpreadsheetApp.getUi();
  const pending = findPending();

  const res = ui.alert(
    'Turn sending on?',
    pending.length + ' volunteer(s) are waiting for a follow-up right now.\n\n' +
    'Once this is on, the script sends up to ' + FU.MAX_PER_RUN + ' emails per hour, ' +
    FU.MAX_PER_DAY + ' per day at most.\n\nContinue?',
    ui.ButtonSet.YES_NO
  );
  if (res !== ui.Button.YES) return;

  PropertiesService.getScriptProperties().setProperty('fu_armed', 'yes');
  ui.alert('Sending is now ON.');
}

function disarmFollowUps() {
  PropertiesService.getScriptProperties().setProperty('fu_armed', 'no');
  SpreadsheetApp.getUi().alert('Sending is now OFF. Nothing will go out.');
}

function showFollowUpStatus() {
  const props = PropertiesService.getScriptProperties();
  const pending = findPending();
  SpreadsheetApp.getUi().alert(
    'Sending: ' + (props.getProperty('fu_armed') === 'yes' ? 'ON' : 'OFF') + '\n' +
    'Waiting to be emailed: ' + pending.length + '\n' +
    'Sent today: ' + sentToday() + ' of ' + FU.MAX_PER_DAY + '\n' +
    'Skipping entries 1 to ' + (props.getProperty('fu_watermark') || '?') + '\n' +
    'Gmail quota left today: ' + MailApp.getRemainingDailyQuota()
  );
}

// ============================================================ PREVIEW / TEST

/** Shows exactly who would be emailed. Sends nothing. */
function previewFollowUps() {
  const pending = findPending();
  const ui = SpreadsheetApp.getUi();
  if (!pending.length) { ui.alert('Nobody is waiting for a follow-up.'); return; }

  const lines = pending.slice(0, 20).map(function (p) {
    return '  ' + p.name + '  <' + p.email + '>';
  });
  ui.alert(
    pending.length + ' waiting. The next run would email up to ' + FU.MAX_PER_RUN + ':\n\n' +
    lines.join('\n') + (pending.length > 20 ? '\n  ...and ' + (pending.length - 20) + ' more' : '')
  );
}

/** Sends one copy to whoever is running the script, using sample values. */
function sendFollowUpTestToMe() {
  const t = readTemplate();
  const to = Session.getEffectiveUser().getEmail();
  const body = renderBody(t.body, {
    name: 'Sample Volunteer',
    firstName: 'Sample',
    interests: 'helping at events\nsetup and takedown',
  });

  MailApp.sendEmail({
    to: to,
    subject: '[TEST] ' + t.subject,
    body: body,
    htmlBody: buildBrandedEmail(body, t),
    name: FU.FROM_NAME,
    replyTo: FU.REPLY_TO || to,
  });
  SpreadsheetApp.getUi().alert('Test sent to ' + to);
}

// ============================================================ SENDING

function sendFollowUpsFromMenu() {
  const ui = SpreadsheetApp.getUi();
  const pending = findPending();
  if (!pending.length) { ui.alert('Nobody is waiting.'); return; }

  const n = Math.min(pending.length, FU.MAX_PER_RUN);
  const res = ui.alert(
    'Send ' + n + ' email(s)?',
    pending.slice(0, n).map(function (p) { return p.name + ' <' + p.email + '>'; }).join('\n'),
    ui.ButtonSet.YES_NO
  );
  if (res !== ui.Button.YES) return;

  const sent = sendVolunteerFollowUps(true);
  ui.alert('Sent ' + sent + '.');
}

/**
 * The only function that sends. Hourly trigger calls it with no argument.
 * @param {boolean} manual  true when a human confirmed from the menu, which
 *                          bypasses the arming switch but nothing else.
 */
function sendVolunteerFollowUps(manual) {
  const props = PropertiesService.getScriptProperties();

  if (!manual && props.getProperty('fu_armed') !== 'yes') return 0;

  const pending = findPending();
  if (!pending.length) return 0;

  // Guard 6. A sudden pile-up means the watermark was reset, the sent column
  // was cleared, or someone pasted in a list. Stop and ask a human.
  if (pending.length > FU.CIRCUIT_BREAKER) {
    props.setProperty('fu_armed', 'no');
    MailApp.sendEmail({
      to: FU.REPLY_TO || Session.getEffectiveUser().getEmail(),
      subject: '[ASOSC] VF-02 — Follow-up emails paused',
      body: pending.length + ' volunteers are suddenly waiting for a follow-up, ' +
            'which is more than expected.\n\n' +
            'Sending has been turned off so nobody gets emailed by mistake.\n' +
            'Open the sheet, check the Follow-up Sent column looks right, then ' +
            'turn sending back on.',
    });
    return 0;
  }

  const already = sentToday();
  const room = Math.min(FU.MAX_PER_RUN, FU.MAX_PER_DAY - already, MailApp.getRemainingDailyQuota());
  if (room <= 0) return 0;

  const t = readTemplate();
  if (!t.body) return 0;

  const form = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(FU.FORM_TAB);
  const sentCol = columnIndex(form, FU.SENT_COL_HEADER);
  const noteCol = columnIndex(form, FU.NOTE_COL_HEADER);

  const seenThisRun = {};
  let count = 0;

  for (let i = 0; i < pending.length && count < room; i++) {
    const p = pending[i];

    // Two people can share an address. Never send the same address twice.
    if (seenThisRun[p.email]) {
      form.getRange(p.row, noteCol).setValue('Skipped, duplicate address in this batch');
      form.getRange(p.row, sentCol).setValue(new Date());
      continue;
    }

    try {
      const plain = renderBody(t.body, p);
      MailApp.sendEmail({
        to: p.email,
        subject: t.subject,
        body: plain,                                   // fallback for text-only clients
        htmlBody: buildBrandedEmail(plain, t),
        name: FU.FROM_NAME,
        replyTo: FU.REPLY_TO || Session.getEffectiveUser().getEmail(),
      });
      // Mark immediately. If the script dies on the next row, this one is
      // still recorded and will not be sent again.
      form.getRange(p.row, sentCol).setValue(new Date());
      seenThisRun[p.email] = true;
      count++;
    } catch (err) {
      form.getRange(p.row, noteCol).setValue('VF-03 ' + String(err).slice(0, 120));
    }
  }

  props.setProperty('fu_dayKey', todayKey());
  props.setProperty('fu_dayCount', String(already + count));
  return count;
}

// ============================================================ SELECTION

/**
 * Everyone eligible right now. All the exclusions live here so there is one
 * place to read and one place to audit.
 */
function findPending() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const form = ss.getSheetByName(FU.FORM_TAB);
  if (!form || form.getLastRow() < 2) return [];

  const sentCol = columnIndex(form, FU.SENT_COL_HEADER);
  if (sentCol < 1) return [];

  const watermark = Number(PropertiesService.getScriptProperties().getProperty('fu_watermark') || 0);
  const values = form.getDataRange().getValues();
  const out = [];

  for (let r = 1; r < values.length; r++) {
    const row = values[r];
    const entryId = Number(row[0]);
    const name = String(row[1] || '').trim();
    const email = String(row[2] || '').trim().toLowerCase();
    const interests = String(row[4] || '').trim();
    const sent = row[sentCol - 1];

    if (!email || email.indexOf('@') === -1) continue;   // no address
    if (sent) continue;                                   // guard 2

    // Guard 1. A blank or non-numeric Entry ID cannot be compared against the
    // watermark, so it is skipped rather than assumed new. Rows pasted in by
    // hand, imported from elsewhere, or written before Entry IDs existed all
    // land here — exactly the rows we must not email.
    if (!Number.isFinite(entryId) || entryId <= 0) continue;
    if (entryId <= watermark) continue;

    out.push({
      row: r + 1,
      entryId: entryId,
      name: name,
      firstName: name.split(' ')[0] || name,
      email: email,
      interests: interests,
    });
  }
  return out;
}

// ============================================================ TEMPLATE

function readTemplate() {
  const tab = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(FU.TEMPLATE_TAB);
  if (!tab) return { body: '', subject: '' };
  return {
    body: String(tab.getRange('A1').getValue() || '').trim(),
    subject: String(tab.getRange('B1').getValue() || '').trim() ||
             'Thanks for signing up to volunteer with ASOSC',
    buttonLabel: String(tab.getRange('B2').getValue() || '').trim(),
    buttonUrl: String(tab.getRange('B3').getValue() || '').trim(),
    preheader: String(tab.getRange('B4').getValue() || '').trim(),
  };
}

/**
 * Fills placeholders. If interests are blank, any line mentioning them is
 * dropped rather than leaving an awkward empty sentence.
 */
function renderBody(template, person) {
  let text = String(template);

  if (!person.interests) {
    text = text.split('\n').filter(function (line) {
      return line.indexOf('{{interests}}') === -1;
    }).join('\n');
  }

  return text
    .replace(/\{\{first_name\}\}/g, person.firstName || 'there')
    .replace(/\{\{name\}\}/g, person.name || 'there')
    .replace(/\{\{interests\}\}/g, String(person.interests || '').replace(/\n/g, ', '))
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function defaultBody() {
  return [
    'Hi {{first_name}},',
    '',
    'Thanks for signing up to volunteer with ASOSC. Your form came through and we have you on the list.',
    '',
    'Someone from our team will get in touch before the next event to sort out what you would like to help with and when you are free. Usually that is a short email or a quick phone call.',
    '',
    'You mentioned you are interested in {{interests}}, so we will keep that in mind when we are matching people to roles. There is normally room to try something else if it turns out you would rather.',
    '',
    'Two things people usually ask about. Most volunteering with us happens around events, so it tends to be a few hours on one day rather than an ongoing commitment. And you do not need any experience for any of it. We will walk you through what to do when you arrive.',
    '',
    'If your availability changes, or you have a question before then, just reply to this email.',
    '',
    'Thanks again for offering to help.',
    '',
    'Busayo Disu',
    'President',
    'Africans Society of Strathcona County',
  ].join('\n');
}

// ============================================================ HELPERS

function columnIndex(sheet, header) {
  const head = sheet.getRange(1, 1, 1, Math.max(sheet.getLastColumn(), 1)).getValues()[0];
  for (let i = 0; i < head.length; i++) {
    if (String(head[i]).trim() === header) return i + 1;
  }
  return -1;
}

function maxEntryId(sheet) {
  if (sheet.getLastRow() < 2) return 0;
  const ids = sheet.getRange(2, 1, sheet.getLastRow() - 1, 1).getValues()
    .map(function (r) { return Number(r[0]); })
    .filter(function (n) { return Number.isFinite(n); });
  return ids.length ? Math.max.apply(null, ids) : 0;
}

function todayKey() {
  return Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');
}

function sentToday() {
  const props = PropertiesService.getScriptProperties();
  if (props.getProperty('fu_dayKey') !== todayKey()) return 0;
  return Number(props.getProperty('fu_dayCount') || 0);
}