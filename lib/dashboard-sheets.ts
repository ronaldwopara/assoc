/** Whitelisted spreadsheets the dashboard is allowed to read/write, keyed by source id. */

export type DashboardSheetSource = "master" | "membership" | "finance";

const ENV_VAR_BY_SOURCE: Record<DashboardSheetSource, string> = {
  master: "GOOGLE_MASTER_SHEET_ID",
  membership: "MEMBERSHIP_SHEET_ID",
  finance: "FINANCE_SHEET_ID",
};

export function isDashboardSheetSource(value: unknown): value is DashboardSheetSource {
  return value === "master" || value === "membership" || value === "finance";
}

/** Resolves a source id to its spreadsheet id via env vars — never trusts a client-supplied spreadsheet id directly. */
export function resolveDashboardSheetId(source: DashboardSheetSource): string {
  const envVar = ENV_VAR_BY_SOURCE[source];
  const id = process.env[envVar]?.trim();
  if (!id) throw new Error(`${envVar} is not configured`);
  return id;
}
