/**
 * The single ASOSC master spreadsheet (GOOGLE_MASTER_SHEET_ID).
 *
 * Clean-slate layout: every tab and header the app reads or writes is defined
 * here, and nothing else in the codebase should hard-code a tab name or point
 * at another spreadsheet. Columns are looked up by header name (see colIndex),
 * so reordering columns in Google Sheets is safe; renaming a header is not.
 */

export const MASTER_TABS = {
  masterList: "Master List",
  volunteers: "Volunteers",
  vendors: "Vendors",
  newsletter: "Newsletter",
  contact: "Contact",
  donations: "Donations",
  payments: "Payments",
  invoices: "Invoices",
  expenses: "Expenses",
} as const;

export type MasterTabKey = keyof typeof MASTER_TABS;
export type MasterTabName = (typeof MASTER_TABS)[MasterTabKey];

/** Shared columns every signup tab starts with. */
const PERSON = ["Timestamp", "Full Name", "Email", "Phone Number"] as const;

export const MASTER_HEADERS: Record<MasterTabKey, readonly string[]> = {
  /**
   * Everyone who has ever signed up for anything — one row per signup.
   * Membership signups live here too (Source = "Membership"), so the payment
   * and reminder columns only apply to those rows.
   */
  masterList: [
    ...PERSON,
    "Source",
    "Membership Category",
    "Payment Method",
    "Interac Email",
    "Payment Code",
    "Paid",
    "Paid Date",
    "Membership Card URL",
    "Details",
    "Confirmation Sent",
    "Reminder Count",
    "Last Reminder",
    "Reminder Round",
    "Stop Reminders",
  ],
  volunteers: [...PERSON, "Interests", "Comments", "Confirmation Sent"],
  vendors: [
    ...PERSON,
    "Business Name",
    "Vendor Type",
    "Description",
    "Details",
    "Paid",
    "Confirmation Sent",
    // Set Status to "Approved" (and fill in Fee) to send the approval email and start payment reminders.
    "Status",
    "Fee",
    "Payment Code",
    "Approval Sent",
    "Reminder Count",
    "Last Reminder",
    "Reminder Round",
    "Stop Reminders",
  ],
  newsletter: [...PERSON, "Strathcona Resident", "Confirmation Sent"],
  contact: [...PERSON, "Message", "Confirmation Sent"],
  donations: [
    ...PERSON,
    "Amount",
    "Payment Method",
    "Payment Code",
    "Paid",
    "Paid Date",
    "Confirmation Sent",
    "Reminder Count",
    "Last Reminder",
    "Reminder Round",
    "Stop Reminders",
  ],
  /** One row per Interac e-Transfer notice. */
  payments: [
    "Received",
    "Inbox",
    "Gmail Message ID",
    "Payer Name",
    "Payer Email",
    "Amount",
    "Memo",
    "Type",
    "Matched To",
    "Invoice Number",
    "Reference",
  ],
  invoices: [
    "Invoice Number",
    "Date",
    "Payer Name",
    "Payer Email",
    "Description",
    "Amount",
    "Gmail Message ID",
    "Status",
    "Sent At",
  ],
  /** Outgoing money found in the inboxes (Interac debits, invoices, receipts) — see lib/expense-capture.ts. */
  expenses: [
    "Logged At",
    "Inbox",
    "Gmail Message ID",
    "Type",
    "Payee",
    "Amount",
    "Description",
    "Reference",
    "Attachment Link",
  ],
};

export function masterSheetId(): string {
  const id = process.env.GOOGLE_MASTER_SHEET_ID?.trim();
  if (!id) throw new Error("GOOGLE_MASTER_SHEET_ID is not configured");
  return id;
}

/** Case/whitespace-insensitive header lookup; -1 when the column is missing. */
export function colIndex(headers: readonly string[], name: string): number {
  const want = name.trim().toLowerCase();
  return headers.findIndex((h) => String(h ?? "").trim().toLowerCase() === want);
}

/** Build a row in header order from a { header: value } map; unknown keys are ignored. */
export function rowFromFields(headers: readonly string[], fields: Record<string, string>): string[] {
  const byLower = new Map(Object.entries(fields).map(([k, v]) => [k.trim().toLowerCase(), v]));
  return headers.map((h) => byLower.get(String(h).trim().toLowerCase()) ?? "");
}
