/**
 * ASOSC — Interac e-Transfer payments logger.
 * Runs inside the ASOSC Gmail account as a script bound to the Finance
 * spreadsheet. Requires Config.gs and Setup.gs in the same project.
 *
 * WHAT IT DOES, per inbound Interac email
 *   1. Marks the matching row's "PAID OR NOT" as Paid on the Membership
 *      sheet, matched by e-transfer Reply-To email against that sheet's
 *      "Email" column. No match -> nothing changes there.
 *   2. Appends an Income row to this year's "<year>-Income" tab (facts
 *      only: donor/counterparty, amount, a note with the Gmail link —
 *      never a guess at Purpose or PL recognition, see Config.gs).
 * ...and per outbound Interac email: appends an Expenditure row to
 * "<year>-Expenditure" the same way (facts only).
 *
 * Every parsed email — matched or not — gets one row in the Automation Log
 * tab, which is also the dedupe guard's second layer (first layer is the
 * Gmail label below).
 *
 * DESIGN NOTES carried over from the original design (see IMPLEMENTATION_PLAN.md):
 *   - Idempotency guarded twice: Gmail label (never re-read) + a set of
 *     Gmail message IDs already in the Automation Log.
 *   - Parses text/plain, never the ~90KB HTML part, which is far less
 *     stable across Interac template changes.
 *   - Every regex is line-anchored (^...$ with /m), never positional —
 *     Interac reorders the Transfer Details block by direction. A
 *     sequential field walk would silently mangle inbound records.
 *   - Reply-To carries the payer's real email on inbound mail (often
 *     different from the display name) — this is the deterministic match
 *     key. Outbound Reply-To is the bank, not the recipient, so outbound
 *     rows are logged for the audit trail only, never auto-matched.
 *   - Amount does NOT identify a membership tier: ASOSC takes donations at
 *     the same amounts as membership tiers constantly. TIERS is a hint
 *     (informational "Tier Amount Match" style note only), never used to
 *     decide anything.
 */

// ============================================================ ENTRY POINT

function processInteracEmails() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) {
    Logger.log('Another run is in progress. Exiting.');
    return;
  }

  try {
    const label = getOrCreateLabel(CONFIG.PROCESSED_LABEL_PAYMENTS);
    const seen = loadSeenMessageIds();

    const query = 'from:(' + Object.keys(SENDERS).join(' OR ') + ') ' +
                  '-label:' + CONFIG.PROCESSED_LABEL_PAYMENTS;
    const threads = GmailApp.search(query, 0, CONFIG.MAX_THREADS_PER_RUN);
    Logger.log('Threads found: ' + threads.length);

    const doneThreads = [];
    // Apps Script kills any execution at 6 minutes. DKIM verification fetches
    // each message's full raw source, which is slow, so a first run against a
    // mailbox with years of history can hit the wall mid-batch. Stop cleanly
    // at 4.5 minutes instead: unlabeled threads are simply picked up next run.
    const deadline = Date.now() + 4.5 * 60 * 1000;
    let hitDeadline = false;
    let parseFailures = 0;

    threads.forEach(function (thread) {
      if (Date.now() > deadline) { hitDeadline = true; return; }
      thread.getMessages().forEach(function (msg) {
        const from = extractEmail(msg.getFrom());
        const direction = SENDERS[from.toLowerCase()];
        if (!direction) return;                   // not an Interac system address
        if (seen[msg.getId()]) return;            // already logged

        try {
          const record = parseMessage(msg, direction);
          handlePaymentRecord(record);
          seen[msg.getId()] = true;
        } catch (err) {
          Logger.log('AS-03 ' + msg.getId() + ': ' + err);
          parseFailures++;
          // Leave the thread unlabeled so a later run retries it.
        }
      });
      doneThreads.push(thread);
    });

    // A single failure is noise. Several in one batch means Interac probably
    // changed their template, and matching would otherwise quietly stop
    // working — the failure mode nobody notices until reconciliation.
    if (parseFailures >= 3) {
      notifyFailure('Interac parser', parseFailures + ' emails failed to parse.', 'AS-07');
    }

    // Label only after a successful write, so a failed write is retried.
    doneThreads.forEach(function (t) { t.addLabel(label); });

    if (hitDeadline) {
      Logger.log('Stopped early on time budget. Remaining threads resume next run.');
    }

    // Heartbeat for checkPipelineHealth(). A pipeline that silently stops is
    // worse than one that visibly breaks, so record every successful pass.
    PropertiesService.getScriptProperties()
      .setProperty('lastInteracRun', new Date().toISOString());

  } catch (err) {
    notifyFailure('Interac logger', err, 'AS-02');
    throw err;
  } finally {
    lock.releaseLock();
  }
}

// ============================================================ PARSING

function parseMessage(msg, direction) {
  const body = msg.getPlainBody().replace(/\r\n/g, '\n');
  const subject = msg.getSubject();

  const rec = {};
  rec.direction = direction === 'IN' ? 'Received' : 'Sent';
  rec.receivedAt = msg.getDate();
  rec.messageId = msg.getId();
  rec.subject = subject;
  rec.gmailLink = 'https://mail.google.com/mail/u/0/#inbox/' + msg.getId();

  rec.transferDateRaw = pick(body, /^\s*Date:\s*(.+)$/m);            // e.g. "June 20, 2026"
  rec.referenceNumber = pick(body, /^\s*Reference Number:\s*(\S+)/m);
  rec.accountEnding = pick(body, /Account ending in\s*(\d+)/);

  // Message block: "Message:\n<text>" terminated by a blank line or the FAQ footer.
  const msgMatch = body.match(/^\s*Message:\s*\n([\s\S]*?)(?:\n\s*\n|\nFAQ:)/m);
  rec.message = msgMatch ? msgMatch[1].trim() : '';
  rec.keyword = findKeyword(rec.message);

  if (direction === 'IN') {
    rec.amount = money(
      pick(body, /^\s*Amount:\s*\$([\d,]+\.\d{2})/m) ||
      pick(body, /Funds Deposited!\s*\n\s*\$([\d,]+\.\d{2})/) ||
      pick(subject, /\$([\d,]+\.\d{2})/)
    );
    rec.counterpartyName = pick(body, /^\s*Sent From:\s*(.+)$/m) || displayName(msg.getFrom());
    // THE KEY FIELD: Reply-To carries the real sender address on inbound mail.
    rec.counterpartyEmail = extractEmail(msg.getReplyTo() || '').toLowerCase();
    // Footer: "...on behalf of ERIN GATDULA at RBC Royal Bank." Greedy on
    // purpose — a sender name can itself contain " at ".
    rec.counterpartyBank = pick(body, /on behalf of .+ at ([^.\n]+?)\.?\s*$/m);
  } else {
    let amt = pick(subject, /Your \$([\d,]+\.\d{2}) transfer to /);
    let who = pick(subject, /Your \$[\d,]+\.\d{2} transfer to (.+?) has been/);
    if (!amt) {
      amt = pick(subject, /has accepted your transfer of \$([\d,]+\.\d{2})/);
      who = pick(subject, /^(?:Interac e-Transfer:\s*)?(.+?) has accepted your transfer of/);
    }
    if (!amt) amt = pick(body, /\$([\d,]+\.\d{2})\s*\(CAD\)/);
    if (!who) who = pick(body, /you sent to (.+?) has been/) ||
                    pick(body, /transfer you sent to (.+?) for the amount/);

    rec.amount = money(amt);
    rec.counterpartyName = who;
    rec.counterpartyEmail = '';   // outbound Reply-To is the bank, not the recipient
    rec.counterpartyBank = '';
  }

  rec.dkim = CONFIG.VERIFY_DKIM ? checkDkim(msg) : 'skipped';
  rec.tierHint = TIERS[Number(rec.amount) || 0] || '';
  return rec;
}

// ============================================================ ROUTING

/**
 * One inbound/outbound Interac email in, three possible effects out:
 *   1. Membership sheet: mark PAID OR NOT if the email matches a member.
 *   2. Finance sheet: append an Income (inbound) or Expenditure (outbound) row.
 *   3. Automation Log: always, regardless of (1)/(2) outcome — the audit trail.
 * A spoofed email (failed DKIM) skips (1) and (2) entirely and is logged
 * "Blocked — failed verification" so a fraud attempt is visible, not silent.
 */
function handlePaymentRecord(rec) {
  const blocked = rec.dkim === 'FAIL';
  let membershipMatch = '';
  let ledgerWritten = '';

  if (!blocked) {
    if (rec.direction === 'Received' && rec.counterpartyEmail) {
      membershipMatch = markMembershipPaidByEmail(rec.counterpartyEmail);
      ledgerWritten = appendFinanceRow('Income', rec) ? 'Income' : '';
    } else if (rec.direction === 'Sent') {
      ledgerWritten = appendFinanceRow('Expenditure', rec) ? 'Expenditure' : '';
    }
  }

  appendControlRow({
    'Logged At': fmt(new Date()),
    'Kind': 'Interac',
    'Direction': rec.direction,
    'Amount': rec.amount,
    'Counterparty Name': rec.counterpartyName,
    'Counterparty Email': rec.counterpartyEmail,
    'Message': rec.message,
    'Keyword': rec.keyword,
    'Membership Match': membershipMatch,
    'Ledger Row Written': ledgerWritten,
    'DKIM': rec.dkim,
    'Status': blocked ? 'Blocked — failed verification' : 'Logged',
    'Gmail Message ID': rec.messageId,
    'Subject': rec.subject,
  });
}

// ============================================================ MEMBERSHIP MATCHING

/**
 * Email-only match against the Membership sheet's current-year tab, per
 * §"Match strategy": deterministic (Reply-To vs the sheet's own Email
 * column), no name fallback — name matching is guesswork per the original
 * design's own finding (a member paying from an email they never confirmed
 * as their Interac address just won't auto-match, and needs a manual look).
 *
 * Returns the matched member's Name (for the audit row), or '' if no match
 * or no tab for this year.
 */
function markMembershipPaidByEmail(email) {
  const ss = membershipSpreadsheet();
  const year = String(new Date().getFullYear());
  const tab = ss.getSheetByName(year);
  if (!tab || tab.getLastRow() < 2) return '';

  const values = tab.getDataRange().getValues();
  const headers = values[0].map(function (h) { return String(h).trim().toLowerCase(); });
  const emailCol = headers.indexOf('email');
  const nameCol = headers.indexOf('name');
  const paidCol = headers.indexOf('paid or not');
  if (emailCol === -1 || paidCol === -1) return '';

  for (let r = 1; r < values.length; r++) {
    const rowEmail = String(values[r][emailCol]).trim().toLowerCase();
    if (rowEmail && rowEmail === email) {
      const current = String(values[r][paidCol] || '').trim().toLowerCase();
      if (current !== 'paid') {
        tab.getRange(r + 1, paidCol + 1).setValue('Paid');
      }
      return nameCol !== -1 ? String(values[r][nameCol]) : email;
    }
  }
  return '';
}

// ============================================================ FINANCE SHEET

/**
 * Appends one row to "<year>-Income" or "<year>-Expenditure", using the
 * transfer's own date to pick the year (not "today") so a payment received
 * Dec 31 and processed Jan 2 still lands in the right fiscal year's tab.
 *
 * Only ever fills objective facts (see fillRowByHeaderRules calls below).
 * Categorization columns (Expense Type, Category, Purpose, Total recognized
 * in PL, Deferred Income) are left blank for the bookkeeper — see Config.gs
 * fillRowByHeaderRules doc comment and IMPLEMENTATION_PLAN.md §3.5.
 *
 * Returns true if a row was written, false if this year's tab doesn't exist
 * yet (logs AS-09 once and leaves it to the Automation Log only).
 */
function appendFinanceRow(kind, rec) {
  const ss = financeSpreadsheet();
  const transferDate = rec.receivedAt instanceof Date ? rec.receivedAt : new Date();
  const year = String(transferDate.getFullYear());
  const suffix = kind === 'Income' ? 'Income' : 'Expenditure';
  const tab = findYearTab(ss, year, suffix);

  if (!tab) {
    notifyFailure(suffix + ' tab', year + '-' + suffix + ' does not exist', 'AS-09');
    return false;
  }

  const headers = tab.getRange(1, 1, 1, tab.getLastColumn()).getValues()[0];
  const note = 'Auto-logged from Interac ' + (kind === 'Income' ? 'e-Transfer received' : 'e-Transfer sent') +
    ' — ' + (rec.counterpartyName || 'unknown') +
    (rec.counterpartyEmail ? ' <' + rec.counterpartyEmail + '>' : '') +
    (rec.message ? ' — message: "' + rec.message + '"' : '') +
    ' — ' + rec.gmailLink;

  const dateStr = Utilities.formatDate(transferDate, CONFIG.TIMEZONE, 'yyyy-MM-dd');

  const rules = kind === 'Income'
    ? [
        ['purpose', rec.keyword || ''],
        [/amount received/, rec.amount || ''],
        [/recognized/, ''],       // bookkeeper judgment — leave blank
        [/deferred/, ''],         // bookkeeper judgment — leave blank
        ['notes', note],
        ['date', dateStr],
        // The first ("donor/category") column has no reliable header text in
        // the live 2026 tab (it's blank/whitespace) — this rule is the
        // fallback for any otherwise-unmatched header, so it must stay last.
        [/.*/, rec.counterpartyName || ''],
      ]
    : [
        ['expense type', ''],     // bookkeeper judgment — leave blank
        ['category', ''],         // bookkeeper judgment — leave blank
        ['description', rec.subject || 'Outbound Interac e-Transfer'],
        ['vendor', rec.counterpartyName || ''],
        [/cost/, rec.amount || ''],
        ['notes', note],
        ['date', dateStr],
        ['invoice number', ''],
      ];

  const row = fillRowByHeaderRules(headers, rules);
  tab.getRange(tab.getLastRow() + 1, 1, 1, headers.length).setValues([row]);
  return true;
}

// ============================================================ TRIGGER

function installTrigger() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'processInteracEmails') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('processInteracEmails').timeBased().everyMinutes(30).create();
  Logger.log('Trigger installed: every 30 minutes.');
}
