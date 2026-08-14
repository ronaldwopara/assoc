/**
 * ASOSC — Membership confirmation
 * Add as a NEW file in the membership project, alongside Membership_Code.gs
 * (pasted over the old Code.gs) and EmailTemplate.gs.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * PAYMENT CONFIRMATION, NOT A KEYWORD PROMPT
 *
 * This email tells the member their payment is already accounted for
 * ({{payment_instructions}} — one line, same wording for every payment
 * method, just naming which one they used). It does not ask them to do
 * anything else with their bank, e-Transfer message field included — that
 * instruction was removed. Matching a payment to a member is handled
 * elsewhere (by email, in the Interac payments script), not by anything
 * this email tells the member to type.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * WHAT THIS EMAIL DELIBERATELY DOES NOT CONTAIN
 *
 * The membership form collects home address, age, gender, country of origin,
 * spouse contact details, and the number and ages of children. None of it is
 * echoed back, and there is no internal notification email carrying it.
 *
 * Email is the wrong place for a household's details. The sheet and the
 * dashboard already hold them, behind access control. Anything mailed is
 * copied to a mail server, forwarded, and searchable forever. The confirmation
 * says the tier, the amount, and how to pay.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * INTEGRATION NOTE
 *
 * The payment parser's loadMembers() reads a Members tab for the Interac Email
 * column. That tab lives in the PAYMENTS spreadsheet, not this one. Point it at
 * this spreadsheet by ID, or sync this sheet across. Until one of those is
 * wired, the Interac Email collected here is not reaching the parser.
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
 */

const MB = {
  TEMPLATE_TAB: 'Membership Email',
  SENT_COL_HEADER: 'Welcome Sent',
  NOTE_COL_HEADER: 'Welcome Note',

  FIND: {
    entry: 'entry id',
    name: 'name',
    email: 'email',
    category: 'membership category',
    method: 'payment method',
    interacEmail: 'interac email',
    paid: 'paid or not',
  },

  MAX_PER_RUN: 5,
  MAX_PER_DAY: 25,
  CIRCUIT_BREAKER: 15,

  NOTIFY_EMAIL: '',
  REPLY_TO: '',
  FROM_NAME: 'ASOSC',
  PAID_VALUE: 'Paid',      // written by markExistingMembersPaid()
};

// ============================================================ MENU

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Membership emails')
    .addItem('Preview who would get an email', 'previewMembershipEmails')
    .addItem('Send me a test copy', 'sendMembershipTestToMe')
    .addSeparator()
    .addItem('Send pending confirmations now', 'sendMembershipFromMenu')
    .addSeparator()
    .addItem('Turn sending ON', 'armMembership')
    .addItem('Turn sending OFF', 'disarmMembership')
    .addItem('Status', 'showMembershipStatus')
    .addSeparator()
    .addItem('Mark existing members as paid', 'markExistingMembersPaid')
    .addItem('First-time setup', 'setupMembership')
    .addToUi();
}

// ============================================================ PAID BACKFILL

/**
 * One-time backfill. Writes MB.PAID_VALUE into the PAID OR NOT column for
 * every row that has one blank, and touches nothing else.
 *
 * Scope, deliberately narrow:
 *   - only the PAID OR NOT column is written
 *   - only cells that are currently BLANK are filled, so anything already
 *     recorded ("No", a date, a note) is left exactly as it is
 *   - only rows that actually have a member on them (a name or an email)
 *   - no emails are sent, no other column is touched, no sync runs
 *
 * New sign-ups still arrive with PAID OR NOT blank. This does not change what
 * happens going forward, and it is not on a trigger — it runs only when picked
 * from the menu.
 */
function markExistingMembersPaid() {
  const ui = SpreadsheetApp.getUi();
  const form = mbFormSheet();
  if (!form) { ui.alert('MB-01 — Cannot find a year tab such as 2026.'); return; }

  const paidCol = mbColumnIndex(form, 'PAID OR NOT');
  if (paidCol < 1) { ui.alert('MB-04 — No "PAID OR NOT" column on tab ' + form.getName() + '.'); return; }

  const c = mbResolveColumns(form);
  const lastRow = form.getLastRow();
  if (lastRow < 2) { ui.alert('No members on tab ' + form.getName() + '.'); return; }

  const values = form.getDataRange().getValues();
  const current = form.getRange(2, paidCol, lastRow - 1, 1).getValues();

  let toFill = 0, alreadySet = 0, skipped = 0;

  for (let i = 0; i < current.length; i++) {
    const row = values[i + 1];
    const name = c.name > 0 ? String(row[c.name - 1] || '').trim() : '';
    const email = c.email > 0 ? String(row[c.email - 1] || '').trim() : '';

    if (!name && !email) { skipped++; continue; }              // empty row
    if (String(current[i][0]).trim() !== '') { alreadySet++; continue; }

    current[i][0] = MB.PAID_VALUE;
    toFill++;
  }

  if (!toFill) {
    ui.alert('Nothing to change on tab ' + form.getName() + '.\n\n' +
             alreadySet + ' row(s) already have a value in PAID OR NOT.');
    return;
  }

  const res = ui.alert(
    'Mark ' + toFill + ' member(s) as "' + MB.PAID_VALUE + '"?',
    'Tab: ' + form.getName() + '\n\n' +
    'Will fill: ' + toFill + ' blank cell(s) in PAID OR NOT\n' +
    'Left alone: ' + alreadySet + ' row(s) that already have a value\n' +
    (skipped ? 'Ignored: ' + skipped + ' empty row(s)\n' : '') +
    '\nNothing else is changed and no emails are sent.',
    ui.ButtonSet.YES_NO
  );
  if (res !== ui.Button.YES) return;

  // Single write to the one column. Nothing else on the sheet is touched.
  form.getRange(2, paidCol, current.length, 1).setValues(current);

  ui.alert('Done. ' + toFill + ' member(s) marked "' + MB.PAID_VALUE + '" on tab ' +
           form.getName() + '.\n\nNew sign-ups will still come in blank.');
}

// ============================================================ SETUP

function setupMembership() {
  const ui = SpreadsheetApp.getUi();
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const form = mbFormSheet();
  if (!form) { ui.alert('MB-01 — Cannot find a year tab such as 2026.'); return; }

  mbEnsureTemplateTab(ss);
  mbEnsureTrackingColumns(form);

  const existingMax = mbMaxEntryId(form);
  const props = PropertiesService.getScriptProperties();
  props.setProperty('mb_watermark', String(existingMax));
  props.setProperty('mb_armed', 'no');

  installMembershipTrigger();

  const c = mbResolveColumns(form);
  const warning = c.interacEmail < 1
    ? '\n\nHEADS UP: no "Interac Email" column yet. Paste the updated Code.gs ' +
      'and add the Interac email question to the website form, or the payment ' +
      'parser has nothing to match against.'
    : '';

  ui.alert(
    'Setup done on tab "' + form.getName() + '".\n\n' +
    'Entries 1 to ' + existingMax + ' will never be emailed by this script.\n' +
    'Only sign-ups from now on are eligible.\n\n' +
    'Sending is currently OFF. Edit the wording in the "' + MB.TEMPLATE_TAB +
    '" tab, preview it, then turn sending on when you are happy.' + warning
  );
}

function mbEnsureTemplateTab(ss) {
  let tab = ss.getSheetByName(MB.TEMPLATE_TAB);
  if (tab) return tab;

  tab = ss.insertSheet(MB.TEMPLATE_TAB);
  tab.getRange('A1').setValue(mbDefaultBody());
  tab.getRange('B1').setValue('Your ASOSC membership — one step left');
  tab.getRange('B2').setValue('See what is coming up');
  tab.getRange('B3').setValue('https://www.asosc.ca/events');
  tab.getRange('B4').setValue('');
  tab.getRange('B5').setValue(mbDefaultPaymentBlock());

  tab.getRange('A3').setValue('Body in A1. Subject B1. Button label B2, link B3. Preview text B4.');
  tab.getRange('A4').setValue('B5 = payment confirmation line, same wording for every payment method.');
  tab.getRange('A5').setValue('Placeholders: {{first_name}}, {{name}}, {{category}}, {{amount}}, {{payment_method}}, {{payment_instructions}}');
  tab.getRange('A7').setValue('Do not add address, age, spouse or children details to this email. They are in the sheet already and email is the wrong place for them.');
  tab.getRange('A3:A7').setFontStyle('italic').setFontColor('#666666');

  tab.setColumnWidth(1, 620);
  tab.setColumnWidth(2, 420);
  tab.getRange('A1').setWrap(true).setVerticalAlignment('top');
  tab.getRange('B5').setWrap(true).setVerticalAlignment('top');
  tab.setRowHeight(1, 300);
  return tab;
}

function mbEnsureTrackingColumns(form) {
  const head = form.getRange(1, 1, 1, Math.max(form.getLastColumn(), 1)).getValues()[0]
    .map(function (h) { return String(h).trim(); });

  [MB.SENT_COL_HEADER, MB.NOTE_COL_HEADER].forEach(function (name) {
    if (head.indexOf(name) === -1) {
      form.getRange(1, form.getLastColumn() + 1).setValue(name).setFontWeight('bold');
    }
  });
}

function installMembershipTrigger() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'sendMembershipEmails') ScriptApp.deleteTrigger(t);
  });
  // Every 15 minutes. The payment instructions need to reach someone while they
  // still have their banking app open.
  ScriptApp.newTrigger('sendMembershipEmails').timeBased().everyMinutes(15).create();
}

// ============================================================ ARMING

function armMembership() {
  const ui = SpreadsheetApp.getUi();
  const pending = mbFindPending();
  const res = ui.alert(
    'Turn sending on?',
    pending.length + ' member(s) are waiting for a confirmation right now.\n\n' +
    'Up to ' + MB.MAX_PER_RUN + ' per run, ' + MB.MAX_PER_DAY + ' per day.\n\nContinue?',
    ui.ButtonSet.YES_NO
  );
  if (res !== ui.Button.YES) return;
  PropertiesService.getScriptProperties().setProperty('mb_armed', 'yes');
  ui.alert('Sending is now ON.');
}

function disarmMembership() {
  PropertiesService.getScriptProperties().setProperty('mb_armed', 'no');
  SpreadsheetApp.getUi().alert('Sending is now OFF. Nothing will go out.');
}

function showMembershipStatus() {
  const props = PropertiesService.getScriptProperties();
  const form = mbFormSheet();
  const c = form ? mbResolveColumns(form) : {};
  SpreadsheetApp.getUi().alert(
    'Tab in use: ' + (form ? form.getName() : 'none found') + '\n' +
    'Sending: ' + (props.getProperty('mb_armed') === 'yes' ? 'ON' : 'OFF') + '\n' +
    'Waiting for a confirmation: ' + mbFindPending().length + '\n' +
    'Sent today: ' + mbSentToday() + ' of ' + MB.MAX_PER_DAY + '\n' +
    'Skipping entries 1 to ' + (props.getProperty('mb_watermark') || '?') + '\n' +
    'Interac Email column: ' + (c.interacEmail > 0 ? 'present' : 'MISSING — parser cannot match') + '\n' +
    'Gmail quota left today: ' + MailApp.getRemainingDailyQuota()
  );
}

// ============================================================ PREVIEW / TEST

function previewMembershipEmails() {
  const pending = mbFindPending();
  const ui = SpreadsheetApp.getUi();
  if (!pending.length) { ui.alert('Nobody is waiting for a confirmation.'); return; }

  const lines = pending.slice(0, 20).map(function (p) {
    return '  ' + p.name + '  <' + p.email + '>  ' + mbMoney(p.amount) + '  ' + p.method;
  });
  ui.alert(
    pending.length + ' waiting. The next run would email up to ' + MB.MAX_PER_RUN + ':\n\n' +
    lines.join('\n') + (pending.length > 20 ? '\n  ...and ' + (pending.length - 20) + ' more' : '')
  );
}

/** Sends one per tier and method, so you can check every amount renders. */
function sendMembershipTestToMe() {
  const t = mbReadTemplate();
  const to = Session.getEffectiveUser().getEmail();

  const samples = [
    ['$15 CAD/year - Single/Student - 18 years and older', 'Interac e-transfer'],
    ['$30 CAD/year - Couple/Family with children under 18 years', 'Interac e-transfer'],
    ['$100 CAD/year - Organizational Membership', 'Card'],
  ];

  samples.forEach(function (s) {
    const p = {
      name: 'Sample Member', firstName: 'Sample', email: to,
      category: s[0], amount: mbAmountFrom(s[0]), method: s[1], entryId: 0,
    };
    const body = mbRenderBody(t.body, p, t);
    MailApp.sendEmail({
      to: to,
      subject: '[TEST ' + mbMoney(p.amount) + ' ' + s[1] + '] ' + t.subject,
      body: body,
      htmlBody: buildBrandedEmail(body, t),
      name: MB.FROM_NAME,
      replyTo: MB.REPLY_TO || to,
    });
  });

  SpreadsheetApp.getUi().alert('Three test emails sent to ' + to +
    ':\n  $15 e-transfer\n  $30 e-transfer\n  $100 card');
}

// ============================================================ SENDING

function sendMembershipFromMenu() {
  const ui = SpreadsheetApp.getUi();
  const pending = mbFindPending();
  if (!pending.length) { ui.alert('Nothing is waiting.'); return; }

  const n = Math.min(pending.length, MB.MAX_PER_RUN);
  const res = ui.alert(
    'Send ' + n + ' email(s)?',
    pending.slice(0, n).map(function (p) {
      return p.name + ' <' + p.email + '>  ' + mbMoney(p.amount);
    }).join('\n'),
    ui.ButtonSet.YES_NO
  );
  if (res !== ui.Button.YES) return;
  ui.alert('Sent ' + sendMembershipEmails(true) + '.');
}

/**
 * The only function that sends. The 15-minute trigger calls it with no
 * argument.
 * @param {boolean} manual  true when a human confirmed from the menu, which
 *                          bypasses the arming switch but nothing else.
 */
function sendMembershipEmails(manual) {
  const props = PropertiesService.getScriptProperties();
  if (!manual && props.getProperty('mb_armed') !== 'yes') return 0;

  const pending = mbFindPending();
  if (!pending.length) return 0;

  if (pending.length > MB.CIRCUIT_BREAKER) {
    props.setProperty('mb_armed', 'no');
    MailApp.sendEmail({
      to: MB.NOTIFY_EMAIL || Session.getEffectiveUser().getEmail(),
      subject: '[ASOSC] MB-02 — Membership emails paused',
      body: pending.length + ' members are suddenly waiting, which is more than ' +
            'expected.\n\nSending has been turned off so nobody gets emailed by ' +
            'mistake.\nOpen the sheet, check the Welcome Sent column looks right, ' +
            'then turn sending back on.',
    });
    return 0;
  }

  const already = mbSentToday();
  const room = Math.min(MB.MAX_PER_RUN, MB.MAX_PER_DAY - already, MailApp.getRemainingDailyQuota());
  if (room <= 0) return 0;

  const t = mbReadTemplate();
  if (!t.body) return 0;

  const form = mbFormSheet();
  const sentCol = mbColumnIndex(form, MB.SENT_COL_HEADER);
  const noteCol = mbColumnIndex(form, MB.NOTE_COL_HEADER);

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
      const plain = mbRenderBody(t.body, p, t);
      MailApp.sendEmail({
        to: p.email,
        subject: t.subject,
        body: plain,                              // fallback for text-only clients
        htmlBody: buildBrandedEmail(plain, t),
        name: MB.FROM_NAME,
        replyTo: MB.REPLY_TO || Session.getEffectiveUser().getEmail(),
      });
      // Mark immediately, so a crash on the next row cannot cause a resend.
      form.getRange(p.row, sentCol).setValue(new Date());
      seenThisRun[p.email] = true;
      count++;
    } catch (err) {
      form.getRange(p.row, noteCol).setValue('MB-03 ' + String(err).slice(0, 120));
    }
  }

  props.setProperty('mb_dayKey', mbTodayKey());
  props.setProperty('mb_dayCount', String(already + count));
  return count;
}

// ============================================================ SELECTION

/** Everyone eligible right now. All exclusions live here, in one auditable place. */
function mbFindPending() {
  const form = mbFormSheet();
  if (!form || form.getLastRow() < 2) return [];

  const sentCol = mbColumnIndex(form, MB.SENT_COL_HEADER);
  if (sentCol < 1) return [];

  const c = mbResolveColumns(form);
  if (c.email < 1 || c.entry < 1) return [];

  const watermark = Number(PropertiesService.getScriptProperties().getProperty('mb_watermark') || 0);
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

    const category = at(row, c.category);

    out.push({
      row: r + 1,
      entryId: entryId,
      name: name,
      firstName: name.split(' ')[0] || name,
      email: email,
      category: category,
      amount: mbAmountFrom(category),
      method: at(row, c.method),
      interacEmail: at(row, c.interacEmail).toLowerCase(),
    });
  }
  return out;
}

/** The year tab holding sign-ups. Prefers the current year. */
function mbFormSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const thisYear = String(new Date().getFullYear());
  if (ss.getSheetByName(thisYear)) return ss.getSheetByName(thisYear);

  const years = ss.getSheets()
    .filter(function (s) { return /^\d{4}$/.test(s.getName().trim()); })
    .sort(function (a, b) { return a.getName() < b.getName() ? -1 : 1; });

  return years.length ? years[years.length - 1] : null;
}

/** Fragment matching, so light rewording of the questions does not break this. */
function mbResolveColumns(sheet) {
  const head = sheet.getRange(1, 1, 1, Math.max(sheet.getLastColumn(), 1)).getValues()[0]
    .map(function (h) { return String(h).trim().toLowerCase(); });

  const find = function (fragment) {
    for (let i = 0; i < head.length; i++) {
      if (head[i].indexOf(fragment) !== -1) return i + 1;
    }
    return -1;
  };

  const cols = {};
  Object.keys(MB.FIND).forEach(function (k) { cols[k] = find(MB.FIND[k]); });

  // "name" and "email" both appear inside spouse headers, and "email" also
  // appears inside "Interac Email". Exact matches win so the member's own
  // details are never confused with their spouse's.
  const exactName = head.indexOf('name');
  if (exactName !== -1) cols.name = exactName + 1;
  const exactEmail = head.indexOf('email');
  if (exactEmail !== -1) cols.email = exactEmail + 1;
  const exactInterac = head.indexOf('interac email');
  if (exactInterac !== -1) cols.interacEmail = exactInterac + 1;

  return cols;
}

// ============================================================ TEMPLATE

function mbReadTemplate() {
  const tab = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(MB.TEMPLATE_TAB);
  if (!tab) return { body: '', subject: '' };
  return {
    body: String(tab.getRange('A1').getValue() || '').trim(),
    subject: String(tab.getRange('B1').getValue() || '').trim() ||
             'Your ASOSC membership — one step left',
    buttonLabel: String(tab.getRange('B2').getValue() || '').trim(),
    buttonUrl: String(tab.getRange('B3').getValue() || '').trim(),
    preheader: String(tab.getRange('B4').getValue() || '').trim(),
    paymentBlock: String(tab.getRange('B5').getValue() || '').trim() || mbDefaultPaymentBlock(),
  };
}

function mbRenderBody(template, person, t) {
  const instructions = t.paymentBlock || '';

  const fill = function (s) {
    return String(s)
      .replace(/\{\{first_name\}\}/g, person.firstName || 'there')
      .replace(/\{\{name\}\}/g, person.name || 'there')
      .replace(/\{\{category\}\}/g, mbCategoryLabel(person.category))
      .replace(/\{\{amount\}\}/g, mbMoney(person.amount))
      .replace(/\{\{payment_method\}\}/g, String(person.method || '').toLowerCase())
      .replace(/\{\{email\}\}/g, person.email || '');
  };

  return fill(String(template).replace(/\{\{payment_instructions\}\}/g, fill(instructions)))
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function mbDefaultBody() {
  return [
    'Hi {{first_name}},',
    '',
    'Thanks for signing up for an ASOSC membership. We have your details down for the {{category}}.',
    '',
    '{{payment_instructions}}',
    '',
    'Once your payment comes through we will mark your membership active and sort out your membership card.',
    '',
    'If anything here looks wrong, reply to this email and we will fix it.',
    '',
    'Busayo Disu',
    'President',
    'Africans Society of Strathcona County',
  ].join('\n');
}

function mbDefaultPaymentBlock() {
  return 'We are processing your {{payment_method}} payment of {{amount}}. Nothing else is needed from you.';
}

// ============================================================ HELPERS

/** Pulls the dollar figure out of a category label like "$30 CAD/year - ...". */
function mbAmountFrom(categoryLabel) {
  const m = String(categoryLabel || '').match(/\$\s*([\d,]+(?:\.\d{2})?)/);
  return m ? Number(m[1].replace(/,/g, '')) : 0;
}

/** The readable half of the label, without the price repeated. */
function mbCategoryLabel(categoryLabel) {
  const s = String(categoryLabel || '').trim();
  if (!s) return 'membership';

  const parts = s.split(' - ');
  const readable = parts.length > 1 ? parts.slice(1).join(' - ').trim() : s;

  // "Organizational Membership" already ends with the word, so appending it
  // again reads as "Organizational Membership membership".
  return /membership$/i.test(readable) ? readable : readable + ' membership';
}

function mbMoney(n) {
  const v = Number(n);
  if (!isFinite(v) || v <= 0) return 'your membership fee';
  return '$' + v.toFixed(2);
}

function mbColumnIndex(sheet, header) {
  const head = sheet.getRange(1, 1, 1, Math.max(sheet.getLastColumn(), 1)).getValues()[0];
  for (let i = 0; i < head.length; i++) {
    if (String(head[i]).trim() === header) return i + 1;
  }
  return -1;
}

function mbMaxEntryId(sheet) {
  if (sheet.getLastRow() < 2) return 0;
  const ids = sheet.getRange(2, 1, sheet.getLastRow() - 1, 1).getValues()
    .map(function (r) { return Number(r[0]); })
    .filter(function (n) { return Number.isFinite(n); });
  return ids.length ? Math.max.apply(null, ids) : 0;
}

function mbTodayKey() {
  return Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');
}

function mbSentToday() {
  const props = PropertiesService.getScriptProperties();
  if (props.getProperty('mb_dayKey') !== mbTodayKey()) return 0;
  return Number(props.getProperty('mb_dayCount') || 0);
}