/** Whitelisted spreadsheets the dashboard is allowed to read/write, keyed by source id. */

export type DashboardSheetSource =
  | "master"
  | "membership"
  | "finance"
  | "donor"
  | "volunteer"
  | "vendor"
  | "contact"
  | "newsletter";

const ENV_VAR_BY_SOURCE: Record<DashboardSheetSource, string> = {
  master: "GOOGLE_MASTER_SHEET_ID",
  membership: "MEMBERSHIP_SHEET_ID",
  finance: "FINANCE_SHEET_ID",
  donor: "DONOR_SHEET_ID",
  volunteer: "VOLUNTEER_SHEET_ID",
  vendor: "VENDOR_SHEET_ID",
  contact: "CONTACT_SHEET_ID",
  newsletter: "NEWSLETTER_SHEET_ID",
};

const SOURCES = Object.keys(ENV_VAR_BY_SOURCE) as DashboardSheetSource[];

export function isDashboardSheetSource(value: unknown): value is DashboardSheetSource {
  return typeof value === "string" && (SOURCES as string[]).includes(value);
}

/** Resolves a source id to its spreadsheet id via env vars — never trusts a client-supplied spreadsheet id directly. */
export function resolveDashboardSheetId(source: DashboardSheetSource): string {
  const envVar = ENV_VAR_BY_SOURCE[source];
  const id = process.env[envVar]?.trim();
  if (!id) throw new Error(`${envVar} is not configured`);
  return id;
}
