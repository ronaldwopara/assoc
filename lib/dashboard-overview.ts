/** Aggregates Interac / Expenses / roster data for the staff Overview tab. Every
 * source is optional (an unconfigured spreadsheet just drops that slice) since not
 * every deployment has every sheet wired up. */

import { resolveDashboardSheetId, type DashboardSheetSource } from "@/lib/dashboard-sheets";
import { getAccessTokenForAccount, getSheetValues } from "@/lib/google-sheets";
import { headerIndex, isPaid, loadMatchTargets, type PayableSheet } from "@/lib/interac-payments";
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

function optionalSheetValues(
  accessToken: string,
  source: DashboardSheetSource,
  tab: string,
  errors: string[],
): Promise<{ headers: string[]; rows: string[][] } | null> {
  let spreadsheetId: string;
  try {
    spreadsheetId = resolveDashboardSheetId(source);
  } catch {
    return Promise.resolve(null);
  }
  return getSheetValues(accessToken, spreadsheetId, tab)
    .then((values) => {
      const [headers = [], ...rows] = values;
      return { headers, rows };
    })
    .catch((error) => {
      errors.push(`${source}/${tab}: ${error instanceof Error ? error.message : String(error)}`);
      return null;
    });
}

function rosterStat(label: string, sheet: PayableSheet | null): RosterStat {
  if (!sheet || sheet.paidCol < 0) return { label, paid: 0, unpaid: 0 };
  let paid = 0;
  let unpaid = 0;
  for (const row of sheet.rows) {
    if (isPaid(String(row[sheet.paidCol] ?? ""))) paid += 1;
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

  const [interacLog, expensesLog, matchTargets, volunteers, newsletter, contacts] = await Promise.all([
    optionalSheetValues(accessToken, "interac", "Interac Log", errors),
    optionalSheetValues(accessToken, "interac", "Expenses", errors),
    loadMatchTargets(accessToken).catch((error) => {
      errors.push(error instanceof Error ? error.message : String(error));
      return { membership: null, donation: null, vendor: null, master: null };
    }),
    optionalSheetValues(accessToken, "volunteer", "Sheet1", errors),
    optionalSheetValues(accessToken, "newsletter", "Newsletter", errors),
    optionalSheetValues(accessToken, "contact", "Sheet1", errors),
  ]);

  let matched = 0;
  let unmatched = 0;
  let totalIn = 0;
  if (interacLog) {
    const { headers, rows } = interacLog;
    const dateCol = headerIndex(headers, "logged at");
    const amountCol = headerIndex(headers, "amount");
    const statusCol = headerIndex(headers, "status");
    for (const row of rows) {
      const amount = amountCol >= 0 ? toAmount(String(row[amountCol] ?? "")) : 0;
      totalIn += amount;
      const status = statusCol >= 0 ? String(row[statusCol] ?? "") : "";
      if (/unmatched/i.test(status)) unmatched += 1;
      else matched += 1;

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

  const rosters: RosterStat[] = [
    rosterStat("Members", matchTargets.membership),
    rosterStat("Donations", matchTargets.donation),
    rosterStat("Vendors", matchTargets.vendor),
  ];

  const counts = [
    { label: "Members", value: (matchTargets.membership?.rows.length ?? 0) },
    { label: "Volunteers", value: volunteers?.rows.length ?? 0 },
    { label: "Vendors", value: matchTargets.vendor?.rows.length ?? 0 },
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
