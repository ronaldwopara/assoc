import type { FormValues } from "@/components/guided-form";
import { membershipCategoryOptions } from "@/lib/join-community-forms";
import {
  appendSheetRow,
  getAccessTokenForAccount,
  getSheetValues,
  updateSheetRow,
} from "@/lib/google-sheets";
import { formatTimestamp } from "@/lib/sheet-dates";

const CARD_URL_HEADER = "Membership Card URL";
const INTERAC_EMAIL_HEADER = "Interac Email";
const INTERAC_SAME_HEADER = "Interac Same?";
const TIMESTAMP_HEADER = "Timestamp";
const SELF_HEALING_HEADERS = [
  INTERAC_EMAIL_HEADER,
  INTERAC_SAME_HEADER,
  CARD_URL_HEADER,
  TIMESTAMP_HEADER,
];

function requireMembershipSheetId(): string {
  const id = process.env.MEMBERSHIP_SHEET_ID?.trim();
  if (!id) throw new Error("MEMBERSHIP_SHEET_ID is not configured");
  return id;
}

function currentYearTab(): string {
  return process.env.MEMBERSHIP_SHEET_TAB?.trim() || String(new Date().getFullYear());
}

function asString(value: FormValues[string] | undefined): string {
  if (Array.isArray(value)) return value.join("\n");
  return value ?? "";
}

function nextEntryId(rows: string[][]): string {
  let max = 0;
  for (const row of rows) {
    const n = Number(row[0]);
    if (Number.isFinite(n) && n > max) max = n;
  }
  return String(max + 1);
}

function paymentMethodLabel(method: string): string {
  if (method === "card") return "Card";
  if (method === "etransfer") return "e-Transfer";
  return method;
}

function membershipCategoryLabel(value: string): string {
  const category = membershipCategoryOptions.find((option) => option.value === value);
  return category ? `${category.title} (${category.price})` : value;
}

/** Maps a submitted membership form's values onto a Sheet header name. */
function fieldForHeader(header: string, values: FormValues): string | null {
  switch (header) {
    case "Name":
      return [values.firstName, values.lastName]
        .map((part) => asString(part).trim())
        .filter(Boolean)
        .join(" ");
    case "Email":
      return asString(values.email);
    case "Phone Number":
      return asString(values.phone);
    case "Residential Address":
      return asString(values.address);
    case "Age":
      return asString(values.age);
    case "Gender":
      return asString(values.gender);
    case "Country of Origin":
      return asString(values.countryOfOrigin);
    case "Membership Category":
      return membershipCategoryLabel(asString(values.membershipCategory));
    case "Spouse's Full Name":
      return asString(values.spouseName);
    case "Spouse's email address":
      return asString(values.spouseEmail);
    case "Spouse's phone number":
      return asString(values.spousePhone);
    case "Spouse's residential address, if different from yours":
      return asString(values.spouseAddress);
    case "Does your spouse consent to receive emails and text messages on updates about ASOSC activities?":
      return asString(values.spouseConsent);
    case "Do you want to register your children?":
      return asString(values.registerChildren);
    case "Number of children":
      return asString(values.childrenCount);
    case "Ages of your children":
      return asString(values.childrenAges);
    case "How would you like to participate in ASOSC activities":
      return asString(values.membershipParticipation);
    case "Do you consent to receive emails and text messages on updates about ASOSC activities?":
      return asString(values.consent);
    case "Payment Method":
      return paymentMethodLabel(asString(values.paymentMethod));
    case "Comments":
      return asString(values.comments);
    case "PAID OR NOT":
      // Left blank — set by the Apps Script poller once an Interac/card payment is confirmed.
      return "";
    case INTERAC_EMAIL_HEADER: {
      const interacEmail = asString(values.interacEmail).trim();
      if (interacEmail) return interacEmail;
      // "Yes" means the contact email is also the banking address.
      return asString(values.interacSame) === "Yes" ? asString(values.email) : "";
    }
    case INTERAC_SAME_HEADER:
      return asString(values.interacSame);
    case CARD_URL_HEADER:
      return asString(values.membershipCardUrl);
    case TIMESTAMP_HEADER:
      return formatTimestamp(new Date());
    default:
      return null;
  }
}

/** Appends a membership submission directly to the live Google Sheet, self-healing the card-URL column if it's missing. */
export async function appendMembershipRow(values: FormValues): Promise<void> {
  const spreadsheetId = requireMembershipSheetId();
  const tabTitle = currentYearTab();
  const { accessToken } = await getAccessTokenForAccount();

  const existing = await getSheetValues(accessToken, spreadsheetId, tabTitle);
  let [headers = []] = existing;
  const dataRows = existing.slice(1);

  const missingHeaders = SELF_HEALING_HEADERS.filter(
    (header) => !headers.some((h) => h.trim().toLowerCase() === header.toLowerCase()),
  );
  if (missingHeaders.length) {
    headers = [...headers, ...missingHeaders];
    await updateSheetRow(accessToken, spreadsheetId, tabTitle, 1, headers);
  }

  const row = headers.map((header) => {
    if (header === "Entry ID") return nextEntryId(dataRows);
    if (/^timestamp$/i.test(header.trim())) return formatTimestamp(new Date());
    return fieldForHeader(header, values) ?? "";
  });

  await appendSheetRow(accessToken, spreadsheetId, tabTitle, row);
}
