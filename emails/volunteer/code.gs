const LOCAL_SHEET_NAME = "Sheet1";

const VOLUNTEER_HEADERS = [
  "Entry ID",
  "Name",
  "Email",
  "Phone Number",
  "How would you like to participate in ASOSC activities?",
  "Comments or Questions",
  "Get Notified of Future Events",
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
    const phone = cleanPhoneNumber(data.phone);

    if (!name || !email) {
      throw new Error("Name and email are required.");
    }

    const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = getRequiredSheet(spreadsheet, LOCAL_SHEET_NAME);
    ensureVolunteerHeaders(sheet);

    const entryId = getNextEntryId(sheet);
    const interests = clean(data.volunteerInterests).replace(/,\s*/g, "\n");
    const futureEvents = normalizeFutureEvents(data.futureEventsOptIn);

    sheet.appendRow([
      entryId,
      name,
      email,
      phone,
      interests,
      clean(data.comments),
      futureEvents,
    ]);

    syncVolunteerWebsite();

    return jsonResponse({ ok: true, entryId });
  } catch (error) {
    return jsonResponse({ ok: false, error: error.message });
  } finally {
    lock.releaseLock();
  }
}

function doGet() {
  return ContentService
    .createTextOutput("Volunteer endpoint is live. Use POST to submit form data.")
    .setMimeType(ContentService.MimeType.TEXT);
}

function syncVolunteerWebsite() {
  const sourceSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Sheet1");

  const masterSpreadsheet = SpreadsheetApp.openById(
    "1_WR_D3yvytd9qi59EPVZ49i7Bo2NK6MI7mYwt587dGM"
  );

  const masterList = masterSpreadsheet.getSheetByName("Master List");
  const volunteersSheet = masterSpreadsheet.getSheetByName("Volunteers");
  const rawSheet = masterSpreadsheet.getSheetByName("Volunteer Website");

  const sourceData = sourceSheet.getDataRange().getValues();
  if (sourceData.length < 2) return;

  const masterEmails = getEmailMap(masterList, 3);
  const volunteerEmails = getEmailMap(volunteersSheet, 3);

  // Sheet1 / raw: email is column C (index 2)
  const rawEmails = new Set(
    rawSheet
      .getDataRange()
      .getValues()
      .slice(1)
      .map((r) => r[2] && r[2].toString().trim().toLowerCase())
  );

  for (let i = 1; i < sourceData.length; i++) {
    // Sheet1: B=name, C=email, D=phone
    let name = sourceData[i][1];
    let email = sourceData[i][2];
    let phone = sourceData[i][3];

    if (!email) continue;

    const timestamp = Utilities.formatDate(
      new Date(),
      Session.getScriptTimeZone(),
      "M/d/yyyy H:mm:ss"
    );

    email = email.toString().trim().toLowerCase();
    phone = cleanPhoneNumber(phone);
    const fullName = formatName(name);

    if (masterEmails.has(email)) {
      const r = masterEmails.get(email);
      masterList.getRange(r, 1).setValue(timestamp);
      masterList.getRange(r, 2).setValue(fullName);
      masterList.getRange(r, 3).setValue(email);
      masterList.getRange(r, 4).setValue(phone);
    } else {
      masterList.appendRow([timestamp, fullName, email, phone]);
      masterEmails.set(email, masterList.getLastRow());
    }

    if (volunteerEmails.has(email)) {
      const r = volunteerEmails.get(email);
      volunteersSheet.getRange(r, 1).setValue(timestamp);
      volunteersSheet.getRange(r, 2).setValue(fullName);
      volunteersSheet.getRange(r, 3).setValue(email);
      volunteersSheet.getRange(r, 4).setValue(phone);
    } else {
      volunteersSheet.appendRow([timestamp, fullName, email, phone]);
      volunteerEmails.set(email, volunteersSheet.getLastRow());
    }

    if (!rawEmails.has(email)) {
      rawSheet.appendRow(sourceData[i]);
      rawEmails.add(email);
    }
  }
}

function ensureVolunteerHeaders(sheet) {
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(VOLUNTEER_HEADERS);
    return;
  }
  sheet.getRange(1, 1, 1, VOLUNTEER_HEADERS.length).setValues([VOLUNTEER_HEADERS]);
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

function normalizeFutureEvents(value) {
  const normalized = clean(value).toLowerCase();
  if (normalized === "yes") {
    return "I would like to receive email updates regarding future conferences";
  }
  if (normalized === "no") {
    return "No thanks";
  }
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

function cleanPhoneNumber(phone) {
  if (!phone) return "";
  return phone.toString().replace(/\D/g, "");
}

function getEmailMap(sheet, emailCol) {
  const data = sheet.getDataRange().getValues();
  const map = new Map();
  for (let r = 1; r < data.length; r++) {
    const email = data[r][emailCol - 1];
    if (email) map.set(email.toString().trim().toLowerCase(), r + 1);
  }
  return map;
}

function jsonResponse(payload) {
  return ContentService.createTextOutput(JSON.stringify(payload)).setMimeType(
    ContentService.MimeType.JSON
  );
}