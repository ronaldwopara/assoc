const LOCAL_SHEET_NAME = "Sheet1";

const CONTACT_HEADERS = [
  "Entry ID",
  "Name",
  "Email",
  "Phone (Optional)",
  "Comment or Message",
];

function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);

  try {
    const data = parseRequestBody(e);

    const firstName = clean(data.firstName);
    const lastName = clean(data.lastName);
    const name = formatName(clean(data.name) || `${firstName} ${lastName}`);
    const email = clean(data.email).toLowerCase();
    const phone = clean(data.phone).replace(/\D/g, "");
    const message = clean(data.message);

    if (!name || !email || !message) {
      throw new Error("Name, email, and message are required.");
    }

    const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = getRequiredSheet(spreadsheet, LOCAL_SHEET_NAME);
    ensureContactHeaders(sheet);

    const entryId = getNextEntryId(sheet);

    sheet.appendRow([
      entryId,
      name,
      email,
      phone,
      message,
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
    .createTextOutput("Contact endpoint is live. Use POST to submit form data.")
    .setMimeType(ContentService.MimeType.TEXT);
}

function ensureContactHeaders(sheet) {
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(CONTACT_HEADERS);
    return;
  }
  sheet.getRange(1, 1, 1, CONTACT_HEADERS.length).setValues([CONTACT_HEADERS]);
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
  return String(value || "").trim();
}

function formatName(name) {
  if (!name) return "";
  return name
    .toString()
    .trim()
    .split(" ")
    .filter((w) => w.length > 0)
    .map((w) => w[0].toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

function jsonResponse(payload) {
  return ContentService.createTextOutput(JSON.stringify(payload)).setMimeType(
    ContentService.MimeType.JSON
  );
}function myFunction() {
  
}
