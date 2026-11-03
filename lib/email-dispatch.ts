/**
 * Which row gets which email, sending it, and stamping "Confirmation Sent" so
 * nobody is emailed twice. Rows copied in from the old sheets were stamped
 * "Imported" when the master sheet was set up, so they never show as pending.
 */

import { getAccessTokenForAccount, getSheetValues, updateSheetCell } from "@/lib/google-sheets";
import { confirmationEmail, paymentReceivedEmail, type ConfirmationKind, type Fields } from "@/lib/emails";
import { sendEmail } from "@/lib/mailer";
import { autoSendEnabled } from "@/lib/settings";
import { getCopyOverrides } from "@/lib/email-store";
import { MASTER_TABS, colIndex, masterSheetId, type MasterTabName } from "@/lib/master-sheet";
import { formatTimestamp, parseSheetDate } from "@/lib/sheet-dates";

/** Tabs whose rows get a confirmation, and the email kind for each. Master List only for membership rows. */
const KIND_BY_TAB: Partial<Record<MasterTabName, ConfirmationKind>> = {
  [MASTER_TABS.masterList]: "membership",
  [MASTER_TABS.donations]: "donation",
  [MASTER_TABS.volunteers]: "volunteer",
  [MASTER_TABS.vendors]: "vendor",
  [MASTER_TABS.contact]: "contact",
  [MASTER_TABS.newsletter]: "newsletter",
  [MASTER_TABS.registrations]: "event",
};

export const CONFIRMATION_TABS = Object.keys(KIND_BY_TAB) as MasterTabName[];

export function isConfirmationTab(tab: unknown): tab is MasterTabName {
  return typeof tab === "string" && (CONFIRMATION_TABS as string[]).includes(tab);
}

function toFields(headers: string[], row: string[]): Fields {
  return Object.fromEntries(headers.map((h, i) => [h.trim(), String(row[i] ?? "").trim()]));
}

function needsConfirmation(tab: MasterTabName, f: Fields): boolean {
  if (tab === MASTER_TABS.masterList && !/^membership$/i.test(f["Source"] ?? "")) return false;
  return !f["Confirmation Sent"] && Boolean(f["Email"]);
}

/** Sends the confirmation for one row and stamps it. Throws if it can't send. */
export async function sendConfirmation(tab: MasterTabName, rowNumber: number): Promise<{ to: string }> {
  const kind = KIND_BY_TAB[tab];
  if (!kind) throw new Error(`${tab} rows don't get a confirmation email`);
  const spreadsheetId = masterSheetId();
  const { accessToken } = await getAccessTokenForAccount();
  const [headers = [], ...rows] = await getSheetValues(accessToken, spreadsheetId, tab);
  const row = rows[rowNumber - 2];
  if (!row) throw new Error(`Row ${rowNumber} not found in ${tab}`);
  const f = toFields(headers, row);
  if (tab === MASTER_TABS.masterList && !/^membership$/i.test(f["Source"] ?? "")) {
    throw new Error("Only membership rows on Master List get a confirmation email");
  }

  await sendEmail(confirmationEmail(kind, f, await getCopyOverrides()));
  const col = colIndex(headers, "Confirmation Sent");
  if (col >= 0) {
    await updateSheetCell(accessToken, spreadsheetId, tab, rowNumber, col + 1, formatTimestamp(new Date()));
  }
  return { to: f["Email"] };
}

export type PendingConfirmation = { tab: MasterTabName; rowNumber: number; name: string; email: string; timestamp: string };

export async function listPendingConfirmations(): Promise<PendingConfirmation[]> {
  const spreadsheetId = masterSheetId();
  const { accessToken } = await getAccessTokenForAccount();
  const pending: PendingConfirmation[] = [];
  await Promise.all(
    CONFIRMATION_TABS.map(async (tab) => {
      const [headers = [], ...rows] = await getSheetValues(accessToken, spreadsheetId, tab);
      rows.forEach((row, i) => {
        const f = toFields(headers, row);
        if (needsConfirmation(tab, f)) {
          pending.push({ tab, rowNumber: i + 2, name: f["Full Name"] ?? "", email: f["Email"], timestamp: f["Timestamp"] ?? "" });
        }
      });
    }),
  );
  return pending;
}

/** Called after a form submission. Never throws — a failed email must not fail the signup. */
export async function autoConfirm(tab: MasterTabName, rowNumber: number): Promise<void> {
  if (!(await autoSendEnabled())) return;
  try {
    await sendConfirmation(tab, rowNumber);
  } catch (error) {
    console.error(`[email] confirmation for ${tab} row ${rowNumber} failed:`, error);
  }
}

/** Days a failed confirmation keeps being retried by the daily run. Older ones wait for staff. */
export const RETRY_DAYS = 3;

/**
 * Daily run: resend confirmations that didn't go out when the person signed up
 * (e.g. Google was busy). Only recent rows, so old unstamped rows are never mass-emailed.
 */
export async function retryRecentConfirmations(): Promise<{ sent: number; failed: number }> {
  if (!(await autoSendEnabled())) return { sent: 0, failed: 0 };
  const cutoff = Date.now() - RETRY_DAYS * 86_400_000;
  const recent = (await listPendingConfirmations()).filter((p) => (parseSheetDate(p.timestamp)?.getTime() ?? 0) >= cutoff);
  let sent = 0;
  let failed = 0;
  for (const p of recent) {
    try {
      await sendConfirmation(p.tab, p.rowNumber);
      sent++;
    } catch (error) {
      failed++;
      console.error(`[email] retry for ${p.tab} row ${p.rowNumber} failed:`, error);
    }
  }
  return { sent, failed };
}

/** Called when a payment marks a signup Paid. Never throws. */
export async function autoPaymentReceived(
  type: "Membership" | "Donation" | "Vendor",
  f: Fields,
  payment: { amount: string; date: string },
): Promise<boolean> {
  if (!f["Email"] || !(await autoSendEnabled())) return false;
  try {
    await sendEmail(paymentReceivedEmail(type, f, payment, await getCopyOverrides()));
    return true;
  } catch (error) {
    console.error(`[email] payment receipt to ${f["Email"]} failed:`, error);
    return false;
  }
}

export { toFields };
