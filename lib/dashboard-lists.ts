/** Dashboard list ids — each maps to a tab in one of the whitelisted spreadsheets (see lib/dashboard-sheets.ts). */

import type { DashboardSheetSource } from "@/lib/dashboard-sheets";

export type DashboardListId =
  | "master-list"
  | "master-volunteer"
  | "master-vendor"
  | "master-guests"
  | "master-newsletter"
  | "master-members"
  | "master-events"
  | "payment-review-membership"
  | "payment-review-donations";

export const DASHBOARD_LISTS: Array<{
  id: DashboardListId;
  title: string;
  /** Exact sheet tab name; empty for lists whose tab is picked dynamically (Events, Payment Review). */
  sheetTab: string;
  /** Which spreadsheet this list reads/writes. Defaults to "master" when omitted. */
  source?: DashboardSheetSource;
}> = [
  { id: "master-list", title: "Master List", sheetTab: "Master List" },
  { id: "master-volunteer", title: "Volunteers", sheetTab: "Volunteers" },
  { id: "master-vendor", title: "Vendors", sheetTab: "Vendors" },
  { id: "master-guests", title: "Guests", sheetTab: "Guests" },
  { id: "master-newsletter", title: "Newsletter", sheetTab: "Newsletter" },
  { id: "master-members", title: "Members", sheetTab: "ASOSC Membership Form 2025" },
  { id: "master-events", title: "Events", sheetTab: "" },
  // Current-year Membership sheet tab (e.g. "2026") — PAID OR NOT lives here.
  { id: "payment-review-membership", title: "Payments", sheetTab: "", source: "membership" },
  // Current-year "<year>-Income" tab on the Finance sheet — every inbound
  // Interac payment (donations, grants, membership) the pipeline logs.
  { id: "payment-review-donations", title: "Donations", sheetTab: "", source: "finance" },
];

/** Sheet tabs already claimed by another list above — excluded from the Events dropdown. */
export const NON_EVENT_TABS = new Set([
  ...DASHBOARD_LISTS.filter((l) => l.sheetTab).map((l) => l.sheetTab),
  "Vendor's Raw Data",
]);

export function listMeta(id: DashboardListId) {
  return DASHBOARD_LISTS.find((l) => l.id === id) ?? DASHBOARD_LISTS[0];
}
