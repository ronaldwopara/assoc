/**
 * ASOSC — Newsletter subscription confirmation
 * Add-on for the newsletter form Apps Script. Paste as a NEW file in the same
 * project as the existing doPost code. Do not replace that file.
 *
 * Sheet layout this expects (from the existing form handler):
 *   A  Entry ID
 *   B  Name
 *   C  Email
 *   D  Do you reside or own a business in Strathcona County?
 *   ...then two columns this script adds: Confirmation Sent, Confirmation Note
 *   ...and one it adds for opt-outs: Unsubscribed
 *
 * ─────────────────────────────────────────────────────────────────────────
 * WHY THIS ONE HAS AN UNSUBSCRIBE COLUMN
 *
 * Canada's anti-spam law requires commercial electronic messages to identify
 * the sender and carry a working unsubscribe mechanism. A volunteer
 * acknowledgement is arguably transactional. A newsletter is not.
 *
 * So this script does two things the volunteer one does not:
 *   - puts an unsubscribe link in the footer of the confirmation
 *   - keeps an Unsubscribed column and never emails anyone marked in it
 *
 * The current mechanism is a mailto:, which is legal and works immediately but
 * means someone has to tick the column by hand. When the dashboard exists, a
 * one-click link is the upgrade. See the note at the bottom of this file for
 * why it cannot be a doGet endpoint in this project.
 * ─────────────────────────────────────────────────────────────────────────
 *
 * SAFEGUARDS — same six as the volunteer script, plus the opt-out check.
 *   1. WATERMARK   Entries that existed at install time are permanently
 *                  excluded. Rows with a blank or non-numeric Entry ID are
 *                  skipped too, since an ID that cannot be compared must not
 *                  be assumed new.
 *   2. SENT COLUMN Per-row timestamp. Never sends twice.
 *   3. ARMING      Off until deliberately turned on from the menu.
 *   4. BATCH CAP   At most 5 per run.
 *   5. DAILY CAP   At most 25 per day.
 *   6. CIRCUIT     More than 15 suddenly pending stops everything.
 *   7. OPT-OUT     Anyone marked Unsubscribed is never contacted.
 *
 * There is deliberately no send-to-everyone function in this file.
 */

const NL = {
  FORM_TAB: 'Newsletter',
  TEMPLATE_TAB: 'Confirmation Email',
  SENT_COL_HEADER: 'Confirmation Sent',
  NOTE_COL_HEADER: 'Confirmation Note',
  OPTOUT_COL_HEADER: 'Unsubscribed',

  MAX_PER_RUN: 5,
  MAX_PER_DAY: 25,
  CIRCUIT_BREAKER: 15,

  REPLY_TO: '',            // blank = the account running the script
  FROM_NAME: 'ASOSC',
  UNSUBSCRIBE: 'mailto:info@asosc.ca?subject=Unsubscribe%20from%20newsletter',
};

// ============================================================ MENU

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Newsletter')
    .addItem('Preview who would get an email', 'previewNewsletterConfirmations')
    .addItem('Send me a test copy', 'sendNewsletterTestToMe')
    .addSeparator()
    .addItem('Send pending confirmations now', 'sendNewsletterFromMenu')
    .addSeparator()
    .addItem('Turn sending ON', 'armNewsletter')
    .addItem('Turn sending OFF', 'disarmNewsletter')
    .addItem('Status', 'showNewsletterStatus')
    .addSeparator()
    .addItem('First-time setup', 'setupNewsletter')
    .addToUi();
}

// ============================================================ SETUP

function setupNewsletter() {
  const ui = SpreadsheetApp.getUi();
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const form = ss.getSheetByName(NL.FORM_TAB);
  if (!form) { ui.alert('NL-01 — Cannot find the ' + NL.FORM_TAB + ' tab.'); return; }

  nlEnsureTemplateTab(ss);
  nlEnsureTrackingColumns(form);

  const existingMax = nlMaxEntryId(form);
  const props = PropertiesService.getScriptProperties();
  props.setProperty('nl_watermark', String(existingMax));
  props.setProperty('nl_armed', 'no');

  installNewsletterTrigger();

  ui.alert(
    'Setup done.\n\n' +
    'Entries 1 to ' + existingMax + ' will never be emailed by this script.\n' +
    'Only people who subscribe from now on are eligible.\n\n' +
    'Sending is currently OFF. Edit the wording in the "' + NL.TEMPLATE_TAB +
    '" tab, preview it, then turn sending on when you are happy.'
  );
}

function nlEnsureTemplateTab(ss) {
  let tab = ss.getSheetByName(NL.TEMPLATE_TAB);
  if (tab) return tab;

  tab = ss.insertSheet(NL.TEMPLATE_TAB);
  tab.getRange('A1').setValue(nlDefaultBody());
  tab.getRange('B1').setValue('You are subscribed to the ASOSC newsletter');
  tab.getRange('B2').setValue('See what is coming up');
  tab.getRange('B3').setValue('https://www.asosc.ca/events');
  tab.getRange('B4').setValue('');
  tab.getRange('B5').setValue(NL.UNSUBSCRIBE);

  tab.getRange('A3').setValue('Body in A1. Subject in B1. Button label B2, button link B3. Preview text B4. Unsubscribe link B5.');
  tab.getRange('A4').setValue('You can use {{first_name}} and {{name}} anywhere in the body.');
  tab.getRange('A5').setValue('Leave B5 filled in. Newsletters need a working unsubscribe link.');
  tab.getRange('A3:A5').setFontStyle('italic').setFontColor('#666666');

  tab.setColumnWidth(1, 620);
  tab.setColumnWidth(2, 340);
  tab.getRange('A1').setWrap(true).setVerticalAlignment('top');
  tab.setRowHeight(1, 300);
  return tab;
}

function nlEnsureTrackingColumns(form) {
  const head = form.getRange(1, 1, 1, Math.max(form.getLastColumn(), 1)).getValues()[0]
    .map(function (h) { return String(h).trim(); });

  [NL.SENT_COL_HEADER, NL.NOTE_COL_HEADER, NL.OPTOUT_COL_HEADER].forEach(function (name) {
    if (head.indexOf(name) === -1) {
      form.getRange(1, form.getLastColumn() + 1).setValue(name).setFontWeight('bold');
    }
  });

  // Checkbox so Busayo can tick an opt-out without typing anything ambiguous.
  const optCol = nlColumnIndex(form, NL.OPTOUT_COL_HEADER);
  if (optCol > 0) {
    form.getRange(2, optCol, Math.max(form.getMaxRows() - 1, 1), 1).insertCheckboxes();
  }
}

function installNewsletterTrigger() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'sendNewsletterConfirmations') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('sendNewsletterConfirmations').timeBased().everyHours(1).create();
}

// ============================================================ ARMING

function armNewsletter() {
  const ui = SpreadsheetApp.getUi();
  const pending = nlFindPending();
  const res = ui.alert(
    'Turn sending on?',
    pending.length + ' subscriber(s) are waiting for a confirmation right now.\n\n' +
    'Once on, the script sends up to ' + NL.MAX_PER_RUN + ' per hour, ' +
    NL.MAX_PER_DAY + ' per day at most.\n\nContinue?',
    ui.ButtonSet.YES_NO
  );
  if (res !== ui.Button.YES) return;
  PropertiesService.getScriptProperties().setProperty('nl_armed', 'yes');
  ui.alert('Sending is now ON.');
}

function disarmNewsletter() {
  PropertiesService.getScriptProperties().setProperty('nl_armed', 'no');
  SpreadsheetApp.getUi().alert('Sending is now OFF. Nothing will go out.');
}

function showNewsletterStatus() {
  const props = PropertiesService.getScriptProperties();
  SpreadsheetApp.getUi().alert(
    'Sending: ' + (props.getProperty('nl_armed') === 'yes' ? 'ON' : 'OFF') + '\n' +
    'Waiting to be emailed: ' + nlFindPending().length + '\n' +
    'Sent today: ' + nlSentToday() + ' of ' + NL.MAX_PER_DAY + '\n' +
    'Skipping entries 1 to ' + (props.getProperty('nl_watermark') || '?') + '\n' +
    'Gmail quota left today: ' + MailApp.getRemainingDailyQuota() + '\n' +
    'Unsubscribe link: ' +
      (nlUnsubscribeFor('test@example.com', '').indexOf('http') === 0
        ? 'one-click (web app deployed)'
        : 'mailto fallback — deploy the web app for one-click')
  );
}

// ============================================================ PREVIEW / TEST

function previewNewsletterConfirmations() {
  const pending = nlFindPending();
  const ui = SpreadsheetApp.getUi();
  if (!pending.length) { ui.alert('Nobody is waiting for a confirmation.'); return; }

  const lines = pending.slice(0, 20).map(function (p) {
    return '  ' + p.name + '  <' + p.email + '>';
  });
  ui.alert(
    pending.length + ' waiting. The next run would email up to ' + NL.MAX_PER_RUN + ':\n\n' +
    lines.join('\n') + (pending.length > 20 ? '\n  ...and ' + (pending.length - 20) + ' more' : '')
  );
}

function sendNewsletterTestToMe() {
  const t = nlReadTemplate();
  const to = Session.getEffectiveUser().getEmail();
  const body = nlRenderBody(t.body, { name: 'Sample Subscriber', firstName: 'Sample' });
  t.unsubscribe = nlUnsubscribeFor(to, t.unsubscribe);

  MailApp.sendEmail({
    to: to,
    subject: '[TEST] ' + t.subject,
    body: body,
    htmlBody: buildBrandedEmail(body, t),
    name: NL.FROM_NAME,
    replyTo: NL.REPLY_TO || to,
  });
  SpreadsheetApp.getUi().alert('Test sent to ' + to);
}

// ============================================================ SENDING

function sendNewsletterFromMenu() {
  const ui = SpreadsheetApp.getUi();
  const pending = nlFindPending();
  if (!pending.length) { ui.alert('Nobody is waiting.'); return; }

  const n = Math.min(pending.length, NL.MAX_PER_RUN);
  const res = ui.alert(
    'Send ' + n + ' email(s)?',
    pending.slice(0, n).map(function (p) { return p.name + ' <' + p.email + '>'; }).join('\n'),
    ui.ButtonSet.YES_NO
  );
  if (res !== ui.Button.YES) return;
  ui.alert('Sent ' + sendNewsletterConfirmations(true) + '.');
}

/**
 * The only function that sends. Hourly trigger calls it with no argument.
 * @param {boolean} manual  true when a human confirmed from the menu, which
 *                          bypasses the arming switch but nothing else.
 */
function sendNewsletterConfirmations(manual) {
  const props = PropertiesService.getScriptProperties();
  if (!manual && props.getProperty('nl_armed') !== 'yes') return 0;

  const pending = nlFindPending();
  if (!pending.length) return 0;

  if (pending.length > NL.CIRCUIT_BREAKER) {
    props.setProperty('nl_armed', 'no');
    MailApp.sendEmail({
      to: NL.REPLY_TO || Session.getEffectiveUser().getEmail(),
      subject: '[ASOSC] NL-02 — Newsletter confirmations paused',
      body: pending.length + ' subscribers are suddenly waiting, which is more ' +
            'than expected.\n\nSending has been turned off so nobody gets emailed ' +
            'by mistake.\nOpen the sheet, check the Confirmation Sent column looks ' +
            'right, then turn sending back on.',
    });
    return 0;
  }

  const already = nlSentToday();
  const room = Math.min(NL.MAX_PER_RUN, NL.MAX_PER_DAY - already, MailApp.getRemainingDailyQuota());
  if (room <= 0) return 0;

  const t = nlReadTemplate();
  if (!t.body) return 0;

  const form = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(NL.FORM_TAB);
  const sentCol = nlColumnIndex(form, NL.SENT_COL_HEADER);
  const noteCol = nlColumnIndex(form, NL.NOTE_COL_HEADER);

  const seenThisRun = {};
  let count = 0;

  for (let i = 0; i < pending.length && count < room; i++) {
    const p = pending[i];

    if (seenThisRun[p.email]) {
      form.getRange(p.row, noteCol).setValue('Skipped, duplicate address in this batch');
      form.getRange(p.row, sentCol).setValue(new Date());
      continue;
    }

    try {
      const plain = nlRenderBody(t.body, p);
      const opts = {
        buttonLabel: t.buttonLabel,
        buttonUrl: t.buttonUrl,
        preheader: t.preheader,
        unsubscribe: nlUnsubscribeFor(p.email, t.unsubscribe),
      };
      MailApp.sendEmail({
        to: p.email,
        subject: t.subject,
        body: plain,                              // fallback for text-only clients
        htmlBody: buildBrandedEmail(plain, opts),
        name: NL.FROM_NAME,
        replyTo: NL.REPLY_TO || Session.getEffectiveUser().getEmail(),
      });
      // Mark immediately, so a crash on the next row cannot cause a resend.
      form.getRange(p.row, sentCol).setValue(new Date());
      seenThisRun[p.email] = true;
      count++;
    } catch (err) {
      form.getRange(p.row, noteCol).setValue('NL-03 ' + String(err).slice(0, 120));
    }
  }

  props.setProperty('nl_dayKey', nlTodayKey());
  props.setProperty('nl_dayCount', String(already + count));
  return count;
}

// ============================================================ SELECTION

/** Everyone eligible right now. All exclusions live here, in one auditable place. */
function nlFindPending() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const form = ss.getSheetByName(NL.FORM_TAB);
  if (!form || form.getLastRow() < 2) return [];

  const sentCol = nlColumnIndex(form, NL.SENT_COL_HEADER);
  const optCol = nlColumnIndex(form, NL.OPTOUT_COL_HEADER);
  if (sentCol < 1) return [];

  const watermark = Number(PropertiesService.getScriptProperties().getProperty('nl_watermark') || 0);
  const values = form.getDataRange().getValues();
  const out = [];

  for (let r = 1; r < values.length; r++) {
    const row = values[r];
    const entryId = Number(row[0]);
    const name = String(row[1] || '').trim();
    const email = String(row[2] || '').trim().toLowerCase();

    if (!email || email.indexOf('@') === -1) continue;          // no address
    if (row[sentCol - 1]) continue;                              // guard 2
    if (optCol > 0 && row[optCol - 1] === true) continue;        // guard 7, opted out

    // Guard 1. A blank or non-numeric Entry ID cannot be compared against the
    // watermark, so it is skipped rather than assumed new. Pasted or imported
    // rows land here, which is exactly what we must not email.
    if (!Number.isFinite(entryId) || entryId <= 0) continue;
    if (entryId <= watermark) continue;

    out.push({
      row: r + 1,
      entryId: entryId,
      name: name,
      firstName: name.split(' ')[0] || name,
      email: email,
    });
  }
  return out;
}

// ============================================================ TEMPLATE

function nlReadTemplate() {
  const tab = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(NL.TEMPLATE_TAB);
  if (!tab) return { body: '', subject: '' };
  return {
    body: String(tab.getRange('A1').getValue() || '').trim(),
    subject: String(tab.getRange('B1').getValue() || '').trim() ||
             'You are subscribed to the ASOSC newsletter',
    buttonLabel: String(tab.getRange('B2').getValue() || '').trim(),
    buttonUrl: String(tab.getRange('B3').getValue() || '').trim(),
    preheader: String(tab.getRange('B4').getValue() || '').trim(),
    unsubscribe: String(tab.getRange('B5').getValue() || '').trim() || NL.UNSUBSCRIBE,
  };
}

/**
 * The unsubscribe link is per-recipient, not one shared link, because it
 * carries a token tied to that address.
 *
 * Falls back in two steps so this never becomes the reason an email fails to
 * send: if the web app is not deployed yet, or Code.gs has not been updated,
 * the mailto in B5 is used instead. Both are legal; only the one-click version
 * is nicer.
 */
function nlUnsubscribeFor(email, fallback) {
  try {
    if (typeof unsubscribeUrlFor === 'function') {
      const url = unsubscribeUrlFor(email);
      if (url) return url;
    }
  } catch (err) { /* fall through */ }
  return fallback || NL.UNSUBSCRIBE;
}

function nlRenderBody(template, person) {
  return String(template)
    .replace(/\{\{first_name\}\}/g, person.firstName || 'there')
    .replace(/\{\{name\}\}/g, person.name || 'there')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function nlDefaultBody() {
  return [
    'Hi {{first_name}},',
    '',
    'You are on the list. Thanks for subscribing to the ASOSC newsletter.',
    '',
    'We send an update roughly once a month, and a bit more often in the weeks before something big like the African Festival. It covers what is coming up, how to get involved, and what has been happening around Strathcona County.',
    '',
    'That is the only thing we will use your email address for, and we do not share it with anyone.',
    '',
    'If you change your mind, every newsletter has an unsubscribe link at the bottom, or you can reply to this message and we will take you off the list.',
    '',
    'Busayo Disu',
    'President',
    'Africans Society of Strathcona County',
  ].join('\n');
}

// ============================================================ HELPERS

function nlColumnIndex(sheet, header) {
  const head = sheet.getRange(1, 1, 1, Math.max(sheet.getLastColumn(), 1)).getValues()[0];
  for (let i = 0; i < head.length; i++) {
    if (String(head[i]).trim() === header) return i + 1;
  }
  return -1;
}

function nlMaxEntryId(sheet) {
  if (sheet.getLastRow() < 2) return 0;
  const ids = sheet.getRange(2, 1, sheet.getLastRow() - 1, 1).getValues()
    .map(function (r) { return Number(r[0]); })
    .filter(function (n) { return Number.isFinite(n); });
  return ids.length ? Math.max.apply(null, ids) : 0;
}

function nlTodayKey() {
  return Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');
}

function nlSentToday() {
  const props = PropertiesService.getScriptProperties();
  if (props.getProperty('nl_dayKey') !== nlTodayKey()) return 0;
  return Number(props.getProperty('nl_dayCount') || 0);
}

/**
 * NOTE ON ONE-CLICK UNSUBSCRIBE
 *
 * The obvious upgrade is a doGet endpoint that ticks the Unsubscribed box when
 * someone clicks a link. It cannot go in this file: the existing form script
 * already defines doGet, and Apps Script shares one scope across every file in
 * a project, so a second doGet would collide and break the form endpoint.
 *
 * Two workable routes when you want it:
 *   - Add the unsubscribe branch INSIDE the existing doGet, keyed on a query
 *     parameter such as ?action=unsubscribe&token=...
 *   - Or handle it on the Vercel dashboard and write back via the Sheets API.
 *
 * Until then the mailto: is legal and works. It just needs a human to tick the
 * box, which is fine at current volume.
 */