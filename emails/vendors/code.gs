const LOCAL_SHEET_NAME = "Vendors";

const VENDOR_HEADERS = [
  "Entry ID",
  "Full Name (First & Last)",
  "Business or Organization Name",
  "Email Address",
  "Phone Number",
  "Website or Social Media Handle (Optional)",
  "What type of vendor are you?",
  "Please provide a brief description of your products or services.",
  "Do your products/services represent a specific African culture or region? If yes, please specify.",
  "Do you require a booth/table to be provided by ASOSC?",
  "Do you require access to electricity?",
  "Will you be using any of the following at your booth?",
  "Do you need access to water?",
  "Do you have a business license?",
  "Do you carry liability insurance?",
  "How did you hear about this opportunity?",
  "Additional comments or special requests (optional)",
  "I understand that completing this form does not guarantee vendor approval, and that ASOSC will contact selected vendors with next steps.",
  "I agree to follow all event guidelines and respect ASOSC’s mission to celebrate African culture with integrity and community spirit.",
  "Entry Date",
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
    const businessName = clean(data.businessName);

    if (!name || !email) {
      throw new Error("Name and email are required.");
    }

    const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = getRequiredSheet(spreadsheet, LOCAL_SHEET_NAME);
    ensureVendorHeaders(sheet);

    const entryId = getNextEntryId(sheet);
    const entryDate = Utilities.formatDate(
      new Date(),
      Session.getScriptTimeZone(),
      "MMMM d, yyyy"
    );

    sheet.appendRow([
      entryId,                                                          // A
      name,                                                             // B
      businessName,                                                     // C
      email,                                                            // D
      phone,                                                            // E
      clean(data.website),                                              // F
      resolveOther(data.vendorType, data.vendorTypeOther),              // G
      clean(data.productsServices),                                     // H
      clean(data.africanCultureRegion),                                 // I
      clean(data.boothRequired),                                        // J
      normalizeYesNo(data.electricityRequired),                         // K
      clean(data.boothEquipment),                                       // L
      normalizeYesNo(data.waterRequired),                               // M
      normalizeYesNo(data.businessLicense),                             // N
      normalizeYesNo(data.liabilityInsurance),                          // O
      resolveOther(data.hearAbout, data.hearAboutOther),                // P
      clean(data.comments),                                             // Q
      clean(data.vendorApprovalUnderstanding),                          // R
      clean(data.vendorGuidelinesAgreement),                            // S
      entryDate,                                                        // T
    ]);

    syncVendorsToMaster();

    return jsonResponse({ ok: true, entryId });
  } catch (error) {
    return jsonResponse({ ok: false, error: error.message });
  } finally {
    lock.releaseLock();
  }
}

function doGet() {
  return ContentService
    .createTextOutput("Vendor endpoint is live. Use POST to submit form data.")
    .setMimeType(ContentService.MimeType.TEXT);
}

function syncVendorsToMaster() {
  const sourceSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Vendors");

  const masterSpreadsheet = SpreadsheetApp.openById(
    "1_WR_D3yvytd9qi59EPVZ49i7Bo2NK6MI7mYwt587dGM"
  );

  const masterList = masterSpreadsheet.getSheetByName("Master List");
  const vendorsSheet = masterSpreadsheet.getSheetByName("Vendors");
  const vendorRawSheet = masterSpreadsheet.getSheetByName("Vendor's Raw Data");

  const sourceData = sourceSheet.getDataRange().getValues();
  if (sourceData.length < 2) return;

  // Master List / Vendors: email is column C (index 3 in getEmailMap)
  const masterEmails = getEmailMap(masterList, 3);
  const vendorEmails = getEmailMap(vendorsSheet, 3);

  // Raw sheet email is column D (index 3) — same layout as website Vendors
  const rawEmails = new Set(
    vendorRawSheet
      .getDataRange()
      .getValues()
      .slice(1)
      .map((r) => r[3] && r[3].toString().trim().toLowerCase())
  );

  for (let i = 1; i < sourceData.length; i++) {
    // Website Vendors sheet: B=name, D=email, E=phone
    let name = sourceData[i][1];
    let email = sourceData[i][3];
    let phone = sourceData[i][4];

    if (!email) continue;

    const timestamp = Utilities.formatDate(
      new Date(),
      Session.getScriptTimeZone(),
      "M/d/yyyy H:mm:ss"
    );

    email = email.toString().trim().toLowerCase();
    name = formatName(name);
    phone = phone ? phone.toString().replace(/\D/g, "") : "";

    if (masterEmails.has(email)) {
      const r = masterEmails.get(email);
      masterList.getRange(r, 1).setValue(timestamp);
      masterList.getRange(r, 2).setValue(name);
      masterList.getRange(r, 3).setValue(email);
      masterList.getRange(r, 4).setValue(phone);
      highlightPhone(masterList.getRange(r, 4), phone);
    } else {
      masterList.appendRow([timestamp, name, email, phone]);
      const newRow = masterList.getLastRow();
      highlightPhone(masterList.getRange(newRow, 4), phone);
      masterEmails.set(email, newRow);
    }

    if (vendorEmails.has(email)) {
      const r = vendorEmails.get(email);
      vendorsSheet.getRange(r, 1).setValue(timestamp);
      vendorsSheet.getRange(r, 2).setValue(name);
      vendorsSheet.getRange(r, 3).setValue(email);
      vendorsSheet.getRange(r, 4).setValue(phone);
      highlightPhone(vendorsSheet.getRange(r, 4), phone);
    } else {
      vendorsSheet.appendRow([timestamp, name, email, phone]);
      const newRow = vendorsSheet.getLastRow();
      highlightPhone(vendorsSheet.getRange(newRow, 4), phone);
      vendorEmails.set(email, newRow);
    }

    if (!rawEmails.has(email)) {
      vendorRawSheet.appendRow(sourceData[i]);
      rawEmails.add(email);
    }
  }
}

function ensureVendorHeaders(sheet) {
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(VENDOR_HEADERS);
    return;
  }
  sheet.getRange(1, 1, 1, VENDOR_HEADERS.length).setValues([VENDOR_HEADERS]);
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

function resolveOther(value, otherValue) {
  const primary = clean(value);
  if (primary === "Other (please specify)") {
    return clean(otherValue) || primary;
  }
  return primary;
}

function normalizeYesNo(value) {
  const normalized = clean(value).toLowerCase();
  if (normalized === "yes") return "Yes";
  if (normalized === "no") return "No";
  return "";
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

function highlightPhone(range, phone) {
  if (phone.length > 10) {
    range.setBackground("red");
  } else {
    range.setBackground(null);
  }
}

function getEmailMap(sheet, emailCol) {
  const data = sheet.getDataRange().getValues();
  const map = new Map();
  for (let r = 1; r < data.length; r++) {
    const email = data[r][emailCol - 1];
    if (email) {
      map.set(email.toString().trim().toLowerCase(), r + 1);
    }
  }
  return map;
}

function jsonResponse(payload) {
  return ContentService.createTextOutput(JSON.stringify(payload)).setMimeType(
    ContentService.MimeType.JSON
  );
}