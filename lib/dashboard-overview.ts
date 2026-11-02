/** Aggregates Interac / Expenses / roster data for the staff Overview tab. Every
 * source is optional (an unconfigured spreadsheet just drops that slice) since not
 * every deployment has every sheet wired up. */

import { getAccessTokenForAccount, getSheetValues } from "@/lib/google-sheets";
import { headerIndex, isPaid } from "@/lib/gmail";
import { MASTER_TABS, colIndex, masterSheetId } from "@/lib/master-sheet";
import { parseSheetDate } from "@/lib/sheet-dates";

export const DEFAULT_MONTHS_BACK = 6;
export const MIN_MONTHS_BACK = 1;
export const MAX_MONTHS_BACK = 24;

export type MonthBucket = { month: string; label: string; in: number; out: number };
export type ExpenseTypeSlice = { type: "Debit" | "Invoice" | "Receipt"; total: number; count: number };
export type RosterStat = { label: string; paid: number; unpaid: number };

export type OverviewData = {
  cashFlow: MonthBucket[];
  expenseByType: ExpenseTypeSlice[];
  interac: { matched: number; unmatched: number; totalIn: number };
  expenses: { total: number; count: number };
  rosters: RosterStat[];
  counts: Array<{ label: string; value: number }>;
  errors: string[];
};

function monthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(date: Date, withYear: boolean): string {
  return date.toLocaleDateString("en-CA", withYear ? { month: "short", year: "2-digit" } : { month: "short" });
}

function lastNMonths(n: number): { key: string; label: string }[] {
  const now = new Date();
  const withYear = n > 12;
  const out: { key: string; label: string }[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    out.push({ key: monthKey(d), label: monthLabel(d, withYear) });
  }
  return out;
}

function toAmount(value: string): number {
  const n = Number(String(value ?? "").replace(/[^0-9.-]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

type Sheet = { headers: string[]; rows: string[][] };

function masterTab(accessToken: string, tab: string, errors: string[]): Promise<Sheet | null> {
  let spreadsheetId: string;
  try {
    spreadsheetId = masterSheetId();
  } catch (error) {
    errors.push(error instanceof Error ? error.message : String(error));
    return Promise.resolve(null);
  }
  return getSheetValues(accessToken, spreadsheetId, tab)
    .then(([headers = [], ...rows]) => ({ headers, rows }))
    .catch((error) => {
      errors.push(`${tab}: ${error instanceof Error ? error.message : String(error)}`);
      return null;
    });
}

function rosterStat(label: string, sheet: Sheet | null, keep: (row: string[]) => boolean = () => true): RosterStat {
  const paidCol = sheet ? colIndex(sheet.headers, "Paid") : -1;
  if (!sheet || paidCol < 0) return { label, paid: 0, unpaid: 0 };
  let paid = 0;
  let unpaid = 0;
  for (const row of sheet.rows.filter(keep)) {
    if (isPaid(String(row[paidCol] ?? ""))) paid += 1;
    else unpaid += 1;
  }
  return { label, paid, unpaid };
}

export async function getOverview(monthsBack: number = DEFAULT_MONTHS_BACK): Promise<OverviewData> {
  const clamped = Math.min(MAX_MONTHS_BACK, Math.max(MIN_MONTHS_BACK, Math.round(monthsBack)));
  const { accessToken } = await getAccessTokenForAccount();
  const errors: string[] = [];
  const months = lastNMonths(clamped);
  const buckets = new Map<string, MonthBucket>(
    months.map((m) => [m.key, { month: m.key, label: m.label, in: 0, out: 0 }]),
  );

  const [payments, expensesLog, masterList, donations, vendors, volunteers, newsletter, contacts] =
    await Promise.all([
      masterTab(accessToken, MASTER_TABS.payments, errors),
      masterTab(accessToken, MASTER_TABS.expenses, errors),
      masterTab(accessToken, MASTER_TABS.masterList, errors),
      masterTab(accessToken, MASTER_TABS.donations, errors),
      masterTab(accessToken, MASTER_TABS.vendors, errors),
      masterTab(accessToken, MASTER_TABS.volunteers, errors),
      masterTab(accessToken, MASTER_TABS.newsletter, errors),
      masterTab(accessToken, MASTER_TABS.contact, errors),
    ]);

  let matched = 0;
  let unmatched = 0;
  let totalIn = 0;
  if (payments) {
    const { headers, rows } = payments;
    const dateCol = colIndex(headers, "Received");
    const amountCol = colIndex(headers, "Amount");
    const typeCol = colIndex(headers, "Type");
    for (const row of rows) {
      const amount = amountCol >= 0 ? toAmount(String(row[amountCol] ?? "")) : 0;
      totalIn += amount;
      // "Matched" = we know what the payment was for.
      if (typeCol >= 0 && String(row[typeCol] ?? "").trim()) matched += 1;
      else unmatched += 1;

      const parsed = dateCol >= 0 ? parseSheetDate(String(row[dateCol] ?? "")) : null;
      if (!parsed) continue;
      const bucket = buckets.get(monthKey(parsed));
      if (bucket) bucket.in += amount;
    }
  }

  const expenseByType: Record<string, ExpenseTypeSlice> = {
    Debit: { type: "Debit", total: 0, count: 0 },
    Invoice: { type: "Invoice", total: 0, count: 0 },
    Receipt: { type: "Receipt", total: 0, count: 0 },
  };
  let expensesTotal = 0;
  let expensesCount = 0;
  if (expensesLog) {
    const { headers, rows } = expensesLog;
    const dateCol = headerIndex(headers, "logged at");
    const amountCol = headerIndex(headers, "amount");
    const typeCol = headerIndex(headers, "type");
    for (const row of rows) {
      const amount = amountCol >= 0 ? toAmount(String(row[amountCol] ?? "")) : 0;
      const type = typeCol >= 0 ? String(row[typeCol] ?? "").trim() : "";
      if (expenseByType[type]) {
        expenseByType[type].total += amount;
        expenseByType[type].count += 1;
      }
      expensesTotal += amount;
      expensesCount += 1;

      const parsed = dateCol >= 0 ? parseSheetDate(String(row[dateCol] ?? "")) : null;
      if (!parsed) continue;
      const bucket = buckets.get(monthKey(parsed));
      if (bucket) bucket.out += amount;
    }
  }

  const sourceCol = masterList ? colIndex(masterList.headers, "Source") : -1;
  const isMember = (row: string[]) => sourceCol >= 0 && /^membership$/i.test(String(row[sourceCol] ?? "").trim());

  const rosters: RosterStat[] = [
    rosterStat("Members", masterList, isMember),
    rosterStat("Donations", donations),
    rosterStat("Vendors", vendors),
  ];

  const counts = [
    { label: "Master List", value: masterList?.rows.length ?? 0 },
    { label: "Members", value: masterList?.rows.filter(isMember).length ?? 0 },
    { label: "Volunteers", value: volunteers?.rows.length ?? 0 },
    { label: "Vendors", value: vendors?.rows.length ?? 0 },
    { label: "Newsletter", value: newsletter?.rows.length ?? 0 },
    { label: "Contacts", value: contacts?.rows.length ?? 0 },
  ];

  return {
    cashFlow: [...buckets.values()],
    expenseByType: Object.values(expenseByType),
    interac: { matched, unmatched, totalIn },
    expenses: { total: expensesTotal, count: expensesCount },
    rosters,
    counts,
    errors,
  };
}
