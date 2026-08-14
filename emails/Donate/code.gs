/**
 * ASOSC — Donation form endpoint
 * REPLACES the existing donate Code.gs.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * WHAT CHANGED AND WHY
 *
 * The original form stored an amount, a payment method, and nothing about the
 * donor. That has three consequences worth naming:
 *
 *   1. No acknowledgement is possible. There is no address to send to.
 *   2. The Interac parser can never match a donation. When $50 arrives from
 *      quinn.gatdula@gmail.com, nothing in this sheet connects it to a row, so
 *      "PAID OR NOT" stays manual forever.
 *   3. No donor can be issued a receipt without Busayo chasing them.
 *
 * So this version accepts donorName, donorEmail, and donorPhone. It stays
 * backward compatible: if the website has not been updated yet, submissions
 * still succeed and simply leave those cells blank. The follow-up script skips
 * rows with no address, so nothing breaks in the meantime.
 *
 * WEBSITE CHANGE REQUIRED: add name and email fields to the donate form and
 * post them as donorName / donorEmail (donorPhone optional).
 *
 * ─────────────────────────────────────────────────────────────────────────
 * COLUMN ORDER
 *
 * New columns are APPENDED rather than inserted. Inserting Name and Email in
 * the middle would shift every existing row's data one column right while the
 * header row said otherwise — silent corruption of past donations. Appending
 * is uglier to read and correct, which is the right trade.
 * ─────────────────────────────────────────────────────────────────────────
 */

const LOCAL_SHEET_NAME = 'Donations';

const DONATION_HEADERS = [
  'Entry ID',
  'Timestamp',
  'Amount (CAD)',
  'Payment Method',
  'PAID OR NOT',
  'Donor Name',
  'Donor Email',
  'Donor Phone',
];

function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);

  try {
    const data = parseRequestBody(e);

    const amount = clean(data.donationAmount).replace(/[^0-9.]/g, '');
    const paymentMethod = formatPaymentMethod(data.paymentMethod);

    if (!amount) {
      throw new Error('Donation amount is required.');
    }

    // Optional for now so the current form keeps working unchanged.
    const firstName = clean(data.firstName);
    const lastName = clean(data.lastName);
    const donorName = formatName(
      clean(data.donorName) || clean(data.name) || `${firstName} ${lastName}`
    );
    const donorEmail = clean(data.donorEmail || data.email).toLowerCase();
    const donorPhone = clean(data.donorPhone || data.phone).replace(/\D/g, '');

    const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = getRequiredSheet(spreadsheet, LOCAL_SHEET_NAME);
    ensureDonationHeaders(sheet);

    const entryId = getNextEntryId(sheet);
    const timestamp = Utilities.formatDate(
      new Date(),
      Session.getScriptTimeZone(),
      'M/d/yyyy H:mm:ss'
    );

    sheet.appendRow([
      entryId,
      timestamp,
      amount,
      paymentMethod,
      '',              // PAID OR NOT — staff or the Interac parser fills this
      donorName,
      donorEmail,
      donorPhone,
    ]);

    return jsonResponse({ ok: true, entryId });
  } catch (error) {
    return jsonResponse({ ok: false, error: error.message });
  } finally {
    lock.releaseLock();
  }
}

function doGet() {
  return ContentService
    .createTextOutput('Donate endpoint is live. Use POST to submit form data.')
    .setMimeType(ContentService.MimeType.TEXT);
}

function ensureDonationHeaders(sheet) {
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(DONATION_HEADERS);
    return;
  }
  // Writes headers for the columns this file owns. Tracking columns added by
  // DonateFollowUp.gs sit further right and are left alone.
  sheet.getRange(1, 1, 1, DONATION_HEADERS.length).setValues([DONATION_HEADERS]);
}

function getNextEntryId(sheet) {
  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) return 1;

  const ids = sheet
    .getRange(2, 1, lastRow - 1, 1)
    .getValues()
    .flat()
    .map(Number)
    .filter(Number.isFinite);

  return ids.length ? Math.max(...ids) + 1 : 1;
}

function formatPaymentMethod(value) {
  const method = clean(value).toLowerCase();
  if (method === 'etransfer') return 'Interac e-transfer';
  if (method === 'card') return 'Card';
  return clean(value);
}

function getRequiredSheet(spreadsheet, sheetName) {
  const sheet = spreadsheet.getSheetByName(sheetName);
  if (!sheet) throw new Error(`Missing sheet tab: ${sheetName}`);
  return sheet;
}

function parseRequestBody(e) {
  if (!e || !e.postData || !e.postData.contents) {
    return e && e.parameter ? e.parameter : {};
  }
  try {
    return JSON.parse(e.postData.contents);
  } catch (_) {
    return e.parameter || {};
  }
}

function clean(value) {
  return String(value || '').trim();
}

function formatName(name) {
  if (!name) return '';
  return name
    .toString()
    .trim()
    .split(' ')
    .filter(Boolean)
    .map((w) => w[0].toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}

function jsonResponse(payload) {
  return ContentService.createTextOutput(JSON.stringify(payload)).setMimeType(
    ContentService.MimeType.JSON
  );
}