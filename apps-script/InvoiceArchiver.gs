/**
 * ASOSC — Invoice & subscription email archiver.
 * Companion to PaymentsLogger.gs. Same account, same Finance spreadsheet
 * (bound), separate Gmail label and trigger. Requires Config.gs and Setup.gs
 * in the same project.
 *
 * WHAT IT DOES
 *   Finds receipt/invoice/subscription email, saves any attachments to a
 *   dedicated Drive folder (organized by year-month), appends one row to
 *   this year's "<year>-Expenditure" tab with a link to the stored file, and
 *   logs one row to the Automation Log either way (dedupe + audit trail).
 *
 * ON GMAIL'S "PURCHASES" DETECTION
 *   Gmail's purchase detection is a smart-label, not a real label, and its
 *   availability to Apps Script is inconsistent — it depends on the
 *   Workspace admin having smart features enabled, and Google has never
 *   documented it as a stable API surface. So this script does NOT rely on
 *   it alone. It runs three strategies in parallel and unions the results:
 *
 *     1. category:purchases    — Google's detection, when it works
 *     2. a sender allowlist    — the Invoice Senders tab, Busayo-maintained
 *     3. keyword heuristics    — invoice/receipt/subscription + attachment
 *
 *   Run testDetectionStrategies() first (Setup.gs). It reports how many
 *   threads each strategy finds, so you know whether strategy 1 is live in
 *   this account before promising it works.
 */

// ============================================================ ENTRY POINT

function processInvoiceEmails() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) return;

  try {
    const ss = financeSpreadsheet();
    const label = getOrCreateLabel(CONFIG.PROCESSED_LABEL_INVOICES);
    const seen = loadSeenMessageIds();
    const allowlist = loadVendorAllowlist(ss);
    const rootFolder = getOrCreateFolder(CONFIG.DRIVE_FOLDER);

    const found = gatherCandidates(allowlist);
    Logger.log('Candidate threads: ' + found.threads.length);

    const doneThreads = [];

    found.threads.forEach(function (thread) {
      thread.getMessages().forEach(function (msg) {
        if (seen[msg.getId()]) return;
        try {
          const rec = buildInvoiceRecord(msg, found.reasons, allowlist, rootFolder);
          if (rec) {
            handleInvoiceRecord(rec);
            seen[msg.getId()] = true;
          }
        } catch (err) {
          Logger.log('INVOICE FAIL ' + msg.getId() + ': ' + err);
        }
      });
      doneThreads.push(thread);
    });

    doneThreads.forEach(function (t) { t.addLabel(label); });

  } catch (err) {
    notifyFailure('Invoice archiver', err, 'AS-02');
    throw err;
  } finally {
    lock.releaseLock();
  }
}

// ============================================================ DETECTION

function gatherCandidates(allowlist) {
  const base = ' newer_than:' + CONFIG.LOOKBACK_DAYS_INVOICES + 'd -label:' + CONFIG.PROCESSED_LABEL_INVOICES;
  const byId = {};
  const reasons = {};

  function run(query, tag) {
    let threads = [];
    try {
      threads = GmailApp.search(query + base, 0, CONFIG.MAX_INVOICE_THREADS_PER_RUN);
    } catch (e) {
      Logger.log('Query failed [' + tag + ']: ' + e);
      return;
    }
    Logger.log(tag + ' -> ' + threads.length + ' threads');
    threads.forEach(function (t) {
      const id = t.getId();
      if (!byId[id]) byId[id] = t;
      reasons[id] = reasons[id] ? reasons[id] + '+' + tag : tag;
    });
  }

  if (CONFIG.USE_CATEGORY_PURCHASES) run('category:purchases', 'purchases');

  if (allowlist.length) {
    // Gmail caps query length; chunk the allowlist to stay safe.
    for (let i = 0; i < allowlist.length; i += 20) {
      const chunk = allowlist.slice(i, i + 20);
      run('from:(' + chunk.join(' OR ') + ')', 'allowlist');
    }
  }

  if (CONFIG.USE_KEYWORD_HEURISTIC) run(KEYWORD_QUERY + ' has:attachment', 'keyword');

  return {
    threads: Object.keys(byId).map(function (k) { return byId[k]; }),
    reasons: reasons,
  };
}

function loadVendorAllowlist(ss) {
  const tab = ss.getSheetByName(CONFIG.VENDORS_TAB);
  if (!tab || tab.getLastRow() < 2) return [];
  return tab.getRange(2, 1, tab.getLastRow() - 1, 1).getValues()
    .map(function (r) { return String(r[0]).trim(); })
    .filter(Boolean);
}

// ============================================================ RECORD BUILDING

function buildInvoiceRecord(msg, reasons, allowlist, rootFolder) {
  const from = extractEmail(msg.getFrom());
  const domain = from.split('@')[1] || '';
  const rec = {};

  rec.emailDate = msg.getDate();
  rec.fromAddress = from;
  rec.vendor = displayName(msg.getFrom()) || domain;
  rec.subject = msg.getSubject();
  rec.messageId = msg.getId();
  rec.gmailLink = 'https://mail.google.com/mail/u/0/#inbox/' + msg.getId();
  rec.detectedBy = reasons[msg.getThread().getId()] || 'unknown';

  const amt = guessAmount(msg.getPlainBody(), msg.getSubject());
  rec.amount = amt.value;
  rec.currency = amt.currency;
  rec.amountBasis = amt.basis;

  // --- attachments to Drive
  const atts = msg.getAttachments({ includeInlineImages: false, includeAttachments: true })
    .filter(function (a) { return SAVEABLE_MIME.indexOf(a.getContentType()) !== -1; });

  rec.attachmentCount = atts.length;

  if (atts.length) {
    let monthFolder;
    try {
      monthFolder = getOrCreateSubfolder(
        rootFolder, Utilities.formatDate(msg.getDate(), CONFIG.TIMEZONE, 'yyyy-MM')
      );
    } catch (e) {
      notifyFailure('Invoice Drive save', e, 'AS-04');
      monthFolder = null;
    }

    const names = [], links = [];
    if (monthFolder) {
      atts.forEach(function (att) {
        // Prefix keeps files sortable and collision-free across vendors.
        const safeVendor = String(rec.vendor).replace(/[^\w\s-]/g, '').trim().slice(0, 40);
        const fname = Utilities.formatDate(msg.getDate(), CONFIG.TIMEZONE, 'yyyy-MM-dd') +
                      '__' + safeVendor + '__' + att.getName();
        // Skip if an identical filename already exists in this month folder.
        const existing = monthFolder.getFilesByName(fname);
        const file = existing.hasNext() ? existing.next() : monthFolder.createFile(att.copyBlob().setName(fname));
        names.push(fname);
        links.push(file.getUrl());
      });
    }
    rec.savedFiles = names.join('\n');
    rec.driveLinks = links.join('\n');
  } else {
    rec.savedFiles = '';
    rec.driveLinks = '';
  }

  // Confidence: allowlisted senders are trusted, Google's own detection is
  // next, a bare keyword hit is a guess and should be eyeballed.
  const onAllowlist = allowlist.some(function (a) {
    return from.toLowerCase().indexOf(a.toLowerCase()) !== -1 ||
           domain.toLowerCase() === a.toLowerCase().replace(/^@/, '');
  });

  if (onAllowlist) { rec.confidence = 'high'; rec.status = 'Logged'; }
  else if (rec.detectedBy.indexOf('purchases') !== -1) { rec.confidence = 'medium'; rec.status = 'Logged'; }
  else { rec.confidence = 'low'; rec.status = 'Needs Review'; }

  if (!atts.length) rec.status += ' — no attachment';
  if (rec.amount === '') notifyFailure('Invoice amount', rec.subject, 'AS-08');

  return rec;
}

/**
 * Anchored amount extraction. Earlier versions took the LARGEST currency
 * figure in the email — wrong whenever an invoice carries a deposit,
 * credit, or prorated discount (a $10,000 subtotal against an $8,000
 * deposit owes $2,000; "largest wins" confidently reports $10,000). Amounts
 * bind to their labels instead. Returns blank when no anchor is found — an
 * empty cell is honest, a wrong number in a bookkeeping export is not.
 */
function guessAmount(body, subject) {
  const text = String(subject || '') + '\n' + String(body || '');
  const num = function (s) { return Number(String(s).replace(/[^\d.]/g, '')); };
  const currency = /USD|US\$/i.test(text) ? 'USD' : 'CAD';

  const anchors = [
    [/(?:Total\s*Due|Balance\s*Due|Amount\s*Due|Net\s*Payable|Amount\s*Charged|You\s*(?:were\s*)?(?:paid|charged))\s*[:\s]*(?:CAD|USD)?\s*\$?\s*([\d,]+\.\d{2})/i, 'total_due'],
    [/(?:Grand\s*Total|Order\s*Total|Total)\s*[:\s]*(?:CAD|USD)?\s*\$?\s*([\d,]+\.\d{2})/i, 'total'],
  ];

  for (let i = 0; i < anchors.length; i++) {
    const m = text.match(anchors[i][0]);
    if (m) return { value: num(m[1]), currency: currency, basis: anchors[i][1] };
  }

  const seen = (text.match(/(?:CAD|USD|\$)\s?[\d,]+\.\d{2}/g) || []).length;
  return { value: '', currency: '', basis: seen ? 'unanchored(' + seen + ' figures)' : 'none' };
}

// ============================================================ ROUTING

function handleInvoiceRecord(rec) {
  const ss = financeSpreadsheet();
  const year = String(rec.emailDate.getFullYear());
  const tab = findYearTab(ss, year, 'Expenditure');
  let written = '';

  if (tab) {
    const headers = tab.getRange(1, 1, 1, tab.getLastColumn()).getValues()[0];
    const note = 'Auto-logged invoice/receipt — detected by: ' + rec.detectedBy +
      ' (confidence: ' + rec.confidence + ')' +
      (rec.amountBasis ? ' — amount basis: ' + rec.amountBasis : '') +
      (rec.driveLinks ? ' — Drive: ' + rec.driveLinks.split('\n').join(', ') : ' — no attachment') +
      ' — ' + rec.gmailLink;
    const dateStr = Utilities.formatDate(rec.emailDate, CONFIG.TIMEZONE, 'yyyy-MM-dd');

    const row = fillRowByHeaderRules(headers, [
      ['expense type', ''],     // bookkeeper judgment — leave blank
      ['category', ''],         // bookkeeper judgment — leave blank
      ['description', rec.subject || ''],
      ['vendor', rec.vendor || ''],
      [/cost/, rec.amount === '' ? '' : rec.amount],
      ['notes', note],
      ['date', dateStr],
      ['invoice number', ''],   // not reliably extractable — see AS-08 / manual review
    ]);
    tab.getRange(tab.getLastRow() + 1, 1, 1, headers.length).setValues([row]);
    written = 'Expenditure';
  } else {
    notifyFailure('Expenditure tab', year + '-Expenditure does not exist', 'AS-09');
  }

  appendControlRow({
    'Logged At': fmt(new Date()),
    'Kind': 'Invoice',
    'Direction': 'Sent',
    'Amount': rec.amount,
    'Counterparty Name': rec.vendor,
    'Counterparty Email': rec.fromAddress,
    'Message': rec.subject,
    'Keyword': rec.detectedBy,
    'Membership Match': '',
    'Ledger Row Written': written,
    'DKIM': 'n/a',
    'Status': rec.status,
    'Gmail Message ID': rec.messageId,
    'Subject': rec.subject,
  });
}

// ============================================================ DIAGNOSTIC

/**
 * Run this ONCE by hand before trusting the pipeline. It tells you whether
 * category:purchases actually returns anything in this account — which is
 * the single thing you cannot know from outside the mailbox.
 */
function testDetectionStrategies() {
  const probes = [
    ['category:purchases', 'Google purchase detection'],
    ['category:purchases has:attachment', 'Purchases WITH attachment'],
    ['label:^smartlabel_receipt', 'Legacy smart-label (fallback)'],
    [KEYWORD_QUERY, 'Keyword heuristic'],
    [KEYWORD_QUERY + ' has:attachment', 'Keyword WITH attachment'],
  ];
  probes.forEach(function (p) {
    let n = 0;
    try { n = GmailApp.search(p[0] + ' newer_than:' + CONFIG.LOOKBACK_DAYS_INVOICES + 'd', 0, 200).length; }
    catch (e) { Logger.log(p[1] + ': QUERY ERROR — ' + e); return; }
    Logger.log(p[1] + ' [' + p[0] + '] -> ' + n + ' threads');
  });
}

function installInvoiceTrigger() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'processInvoiceEmails') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('processInvoiceEmails').timeBased().everyHours(4).create();
  Logger.log('Invoice trigger installed: every 4 hours.');
}
