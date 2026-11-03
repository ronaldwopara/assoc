/**
 * Payment reminders and vendor approvals, run daily by cron (and on demand
 * from the dashboard).
 *
 *  - Vendors whose Status is "Approved", with a Fee entered, who haven't had the
 *    approval email get a V-#### payment code and the "You're approved" email.
 *  - Unpaid memberships (Master List, Source = Membership), donations, and
 *    approved vendors with a fee get reminders on the dashboard-set schedule:
 *    `perRound` reminders `daysBetween` days apart, then a `pauseDays` pause,
 *    for up to `rounds` rounds. Stops when Paid, or "Stop Reminders" is filled.
 *
 * Only rows created by the new system (they have a payment code) are chased,
 * so imported history is never emailed.
 */

import { getAccessTokenForAccount, getSheetValues, updateSheetCell, updateSheetRow } from "@/lib/google-sheets";
import { reminderEmail, vendorApprovedEmail, type Fields, type ReminderKind } from "@/lib/emails";
import { getCopyOverrides } from "@/lib/email-store";
import { newPaymentCode } from "@/lib/form-submissions";
import { isPaid } from "@/lib/gmail";
import { sendEmail } from "@/lib/mailer";
import { MASTER_HEADERS, MASTER_TABS, colIndex, masterSheetId, type MasterTabKey } from "@/lib/master-sheet";
import { formatTimestamp, parseSheetDate } from "@/lib/sheet-dates";
import { autoSendEnabled, getReminderSchedule, type ReminderSchedule } from "@/lib/settings";

const DAY = 24 * 60 * 60 * 1000;

type Tab = { key: MasterTabKey; name: string; headers: string[]; rows: string[][] };

export type ReminderRunResult = {
  ran: boolean;
  reason?: string;
  approvals: number;
  reminders: Record<ReminderKind, number>;
  errors: string[];
};

async function loadTab(accessToken: string, spreadsheetId: string, key: MasterTabKey): Promise<Tab> {
  const name = MASTER_TABS[key];
  const [headers = [], ...rows] = await getSheetValues(accessToken, spreadsheetId, name);
  // Self-heal columns added to the schema after the sheet was built.
  const missing = MASTER_HEADERS[key].filter((h) => colIndex(headers, h) < 0);
  if (missing.length) {
    headers.push(...missing);
    await updateSheetRow(accessToken, spreadsheetId, name, 1, headers);
  }
  return { key, name, headers, rows };
}

const get = (t: Tab, row: string[], col: string) => String(row[colIndex(t.headers, col)] ?? "").trim();
const fields = (t: Tab, row: string[]): Fields => Object.fromEntries(t.headers.map((h, i) => [h.trim(), String(row[i] ?? "").trim()]));

/** What to do with one row today, given its reminder state. */
export function nextReminder(
  state: { count: number; round: number; last: Date | null; start: Date | null },
  s: ReminderSchedule,
  now: Date,
): { send: false } | { send: true; count: number; round: number } {
  const base = state.last ?? state.start;
  if (!base) return { send: false };
  const since = now.getTime() - base.getTime();
  const round = Math.max(1, state.round || 1);
  const count = Math.max(0, state.count || 0);
  if (count < s.perRound) {
    return since >= s.daysBetween * DAY ? { send: true, count: count + 1, round } : { send: false };
  }
  if (round >= s.rounds) return { send: false };
  return since >= s.pauseDays * DAY ? { send: true, count: 1, round: round + 1 } : { send: false };
}

export async function runReminders({ force = false } = {}): Promise<ReminderRunResult> {
  const result: ReminderRunResult = { ran: false, approvals: 0, reminders: { membership: 0, donation: 0, vendor: 0 }, errors: [] };
  if (!force && !(await autoSendEnabled())) {
    return { ...result, reason: "Automatic emails are off" };
  }
  result.ran = true;

  const spreadsheetId = masterSheetId();
  const { accessToken } = await getAccessTokenForAccount();
  const [schedule, overrides] = await Promise.all([getReminderSchedule(), getCopyOverrides()]);
  const now = new Date();
  const stamp = formatTimestamp(now);

  const setCells = async (t: Tab, rowIndex: number, values: Record<string, string>) => {
    for (const [col, value] of Object.entries(values)) {
      const c = colIndex(t.headers, col);
      if (c < 0) continue;
      await updateSheetCell(accessToken, spreadsheetId, t.name, rowIndex + 2, c + 1, value);
      t.rows[rowIndex][c] = value;
    }
  };

  // 1. Vendor approvals.
  const vendors = await loadTab(accessToken, spreadsheetId, "vendors");
  for (let i = 0; i < vendors.rows.length; i++) {
    const row = vendors.rows[i];
    if (!/^approved$/i.test(get(vendors, row, "Status")) || get(vendors, row, "Approval Sent")) continue;
    if (!get(vendors, row, "Email")) continue;
    // The approval email states the fee and payment code, so wait until a fee is entered.
    if (!get(vendors, row, "Fee")) continue;
    try {
      let code = get(vendors, row, "Payment Code");
      if (!code) {
        code = await newPaymentCode(accessToken, spreadsheetId, "V");
        await setCells(vendors, i, { "Payment Code": code });
      }
      await sendEmail(vendorApprovedEmail(fields(vendors, row), overrides));
      await setCells(vendors, i, { "Approval Sent": stamp, "Reminder Count": "0", "Reminder Round": "1" });
      result.approvals += 1;
    } catch (error) {
      result.errors.push(`Vendor row ${i + 2}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  // 2. Payment reminders.
  const masterList = await loadTab(accessToken, spreadsheetId, "masterList");
  const donations = await loadTab(accessToken, spreadsheetId, "donations");
  const jobs: Array<{ kind: ReminderKind; tab: Tab; eligible: (row: string[]) => boolean; start: (row: string[]) => string }> = [
    {
      kind: "membership",
      tab: masterList,
      eligible: (r) => /^membership$/i.test(get(masterList, r, "Source")),
      start: (r) => get(masterList, r, "Timestamp"),
    },
    { kind: "donation", tab: donations, eligible: () => true, start: (r) => get(donations, r, "Timestamp") },
    {
      kind: "vendor",
      tab: vendors,
      eligible: (r) => /^approved$/i.test(get(vendors, r, "Status")) && Boolean(get(vendors, r, "Fee")) && Boolean(get(vendors, r, "Approval Sent")),
      start: (r) => get(vendors, r, "Approval Sent"),
    },
  ];

  for (const job of jobs) {
    const t = job.tab;
    for (let i = 0; i < t.rows.length; i++) {
      const row = t.rows[i];
      if (!job.eligible(row)) continue;
      if (!get(t, row, "Email") || !get(t, row, "Payment Code")) continue;
      if (isPaid(get(t, row, "Paid")) || get(t, row, "Stop Reminders")) continue;
      const step = nextReminder(
        {
          count: Number(get(t, row, "Reminder Count")) || 0,
          round: Number(get(t, row, "Reminder Round")) || 1,
          last: parseSheetDate(get(t, row, "Last Reminder")),
          start: parseSheetDate(job.start(row)),
        },
        schedule,
        now,
      );
      if (!step.send) continue;
      try {
        await sendEmail(reminderEmail(job.kind, fields(t, row), overrides));
        await setCells(t, i, {
          "Reminder Count": String(step.count),
          "Reminder Round": String(step.round),
          "Last Reminder": stamp,
        });
        result.reminders[job.kind] += 1;
      } catch (error) {
        result.errors.push(`${t.name} row ${i + 2}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  }

  return result;
}
