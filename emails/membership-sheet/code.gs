/**
 * ASOSC — Membership form endpoint
 * REPLACES the existing membership Code.gs.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * TWO FIXES
 *
 * 1. INTERAC EMAIL. The payment parser matches an incoming e-Transfer to a
 *    member using the Reply-To header on Interac's notification, which carries
 *    the payer's real banking address. That address frequently differs from
 *    the one typed into a website form — a real sample from this project shows
 *    a transfer displaying ERIN GATDULA arriving from quinn.gatdula@gmail.com.
 *
 *    Without this field the parser has a key and nothing to match it against,
 *    and every payment becomes a manual hunt. Three new columns:
 *      Interac Email        the banking address
 *      Interac Same?        Yes / No answer from the form
 *      PAID OR NOT is left where it is
 *
 *    WEBSITE CHANGE REQUIRED: after the email field, ask "Is this the email you
 *    use for Interac e-Transfer?" If no, require a second field. Post them as
 *    interacSame ("Yes"/"No") and interacEmail.
 *
 * 2. YEAR-AWARE TAB. The tab name was hardcoded to "2026". On 1 January every
 *    submission would have thrown "Missing sheet tab: 2026" — a silent form
 *    outage discovered by whoever notices no one is signing up. It now prefers
 *    a tab named for the current year and falls back to the most recent
 *    year-named tab that exists, so nothing breaks either way.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * COLUMN ORDER
 *
 * New columns are APPENDED after PAID OR NOT rather than inserted next to the
 * contact email. Inserting would shift every existing member's data one column
 * right while the header row said otherwise. Appending is uglier and correct.
 * ─────────────────────────────────────────────────────────────────────────
 */

const FALLBACK_SHEET_NAME = '2026';

const MEMBERSHIP_HEADERS = [
  'Entry ID',
  'Name',
  'Email',
  'Phone Number',
  'Residential Address',
  'Age',
  'Gender',
  'Country of Origin',
  'Membership Category',
  "Spouse's Full Name",
  "Spouse's email address",
  "Spouse's phone number",
  "Spouse's residential address, if different from yours",
  'Does your spouse consent to receive emails and text messages on updates about ASOSC activities?',
  'Do you want to register your children?',
  'Number of children',
  'Ages of your children',
  'How would you like to participate in ASOSC activities',
  'Do you consent to receive emails and text messages on updates about ASOSC activities?',
  'Payment Method',
  'Comments',
  'PAID OR NOT',
  'Interac Email',
  'Interac Same?',
];

const MEMBERSHIP_CATEGORY_LABELS = {
  organizational: '$100 CAD/year - Organizational Membership',
  single_student: '$15 CAD/year - Single/Student - 18 years and older',
  family: '$30 CAD/year - Couple/Family with children under 18 years',
  senior: '$10 CAD/year - Senior - 65 years and older',
};

function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);

  try {
    const data = parseRequestBody(e);

    const firstName = clean(data.firstName);
    const lastName = clean(data.lastName);
    const name = formatName(clean(data.name) || `${firstName} ${lastName}`);
    const email = clean(data.email).toLowerCase();
    const phone = clean(data.phone).replace(/\D/g, '');

    if (!name || !email) {
      throw new Error('Name and email are required.');
    }

    const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = getRequiredSheet(spreadsheet, resolveMembershipTab(spreadsheet));
    ensureMembershipHeaders(sheet);

    const entryId = getNextEntryId(sheet);
    const includeSpouse = normalizeYesNo(data.includeSpouse) === 'Yes';
    const registerChildren = normalizeYesNo(data.registerChildren) === 'Yes';

    const categoryKey = clean(data.membershipCategory);
    const categoryLabel = MEMBERSHIP_CATEGORY_LABELS[categoryKey] || categoryKey;

    const participation = clean(data.membershipParticipation).replace(/,\s*/g, '\n');

    // Optional for now, so the current form keeps working until the field ships.
    // "Yes" means the contact address is also the banking address, so we copy it
    // rather than leaving the parser with a blank.
    const interacSame = normalizeYesNo(data.interacSame);
    const interacEmailRaw = clean(data.interacEmail).toLowerCase();
    const interacEmail = interacEmailRaw || (interacSame === 'Yes' ? email : '');

    sheet.appendRow([
      entryId,                                                          // A
      name,                                                             // B
      email,                                                            // C
      phone,                                                            // D
      clean(data.address),                                              // E
      clean(data.age),                                                  // F
      clean(data.gender),                                               // G
      clean(data.countryOfOrigin),                                      // H
      categoryLabel,                                                    // I
      includeSpouse ? formatName(data.spouseName) : '',                 // J
      includeSpouse ? clean(data.spouseEmail).toLowerCase() : '',       // K
      includeSpouse ? clean(data.spousePhone).replace(/\D/g, '') : '',  // L
      includeSpouse ? clean(data.spouseAddress) : '',                   // M
      includeSpouse ? normalizeYesNo(data.spouseConsent) : '',          // N
      normalizeYesNo(data.registerChildren),                            // O
      registerChildren ? clean(data.childrenCount) : '',                // P
      registerChildren ? clean(data.childrenAges) : '',                 // Q
      participation,                                                    // R
      normalizeYesNo(data.consent),                                     // S
      formatPaymentMethod(data.paymentMethod),                          // T
      clean(data.comments),                                             // U
      'Not paid',                                                       // V PAID OR NOT
      interacEmail,                                                     // W
      interacSame,                                                      // X
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
    .createTextOutput('Membership endpoint is live. Use POST to submit form data.')
    .setMimeType(ContentService.MimeType.TEXT);
}

/**
 * Prefers a tab named for the current year. Falls back to the highest
 * year-named tab present, then to FALLBACK_SHEET_NAME.
 *
 * Create next year's tab in advance and submissions move over on their own on
 * 1 January. Forget, and they keep landing in the most recent year rather than
 * failing outright.
 */
function resolveMembershipTab(spreadsheet) {
  const thisYear = String(new Date().getFullYear());
  if (spreadsheet.getSheetByName(thisYear)) return thisYear;

  const years = spreadsheet.getSheets()
    .map(function (s) { return s.getName().trim(); })
    .filter(function (n) { return /^\d{4}$/.test(n); })
    .sort();

  return years.length ? years[years.length - 1] : FALLBACK_SHEET_NAME;
}

function ensureMembershipHeaders(sheet) {
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(MEMBERSHIP_HEADERS);
    return;
  }
  // Tracking columns added by MembershipFollowUp.gs sit further right and are
  // left alone.
  sheet.getRange(1, 1, 1, MEMBERSHIP_HEADERS.length).setValues([MEMBERSHIP_HEADERS]);
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

function normalizeYesNo(value) {
  const normalized = clean(value).toLowerCase();
  if (normalized === 'yes') return 'Yes';
  if (normalized === 'no') return 'No';
  return '';
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
    .filter((w) => w.length > 0)
    .map((w) => w[0].toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}

function jsonResponse(payload) {
  return ContentService.createTextOutput(JSON.stringify(payload)).setMimeType(
    ContentService.MimeType.JSON
  );
}