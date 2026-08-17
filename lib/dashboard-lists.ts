/** Dashboard list ids — each maps to a tab in one of the whitelisted spreadsheets (see lib/dashboard-sheets.ts). */

import type { DashboardSheetSource } from "@/lib/dashboard-sheets";

export type DashboardListId =
  | "overview"
  | "master-list"
  | "master-volunteer"
  | "master-vendor"
  | "master-guests"
  | "master-newsletter"
  | "master-contact"
  | "master-members"
  | "master-events"
  | "payment-review-membership"
  | "payment-review-donations"
  | "email-membership-followup";

export const DASHBOARD_LISTS: Array<{
  id: DashboardListId;
  title: string;
  /** Exact sheet tab name; empty for lists whose tab is picked dynamically (Events, Payment Review). */
  sheetTab: string;
  /** Which spreadsheet this list reads/writes. Defaults to "master" when omitted. */
  source?: DashboardSheetSource;
}> = [
  // Landing tab — its own panel, not a row grid.
  { id: "overview", title: "Overview", sheetTab: "" },
  { id: "master-list", title: "Master List", sheetTab: "Master List" },
  { id: "master-volunteer", title: "Volunteers", sheetTab: "Sheet1", source: "volunteer" },
  { id: "master-vendor", title: "Vendors", sheetTab: "Vendors", source: "vendor" },
  { id: "master-guests", title: "Guests", sheetTab: "Guests" },
  { id: "master-newsletter", title: "Newsletter", sheetTab: "Newsletter", source: "newsletter" },
  { id: "master-contact", title: "Contact", sheetTab: "Sheet1", source: "contact" },
  { id: "master-members", title: "Members", sheetTab: "ASOSC Membership Form 2025" },
  { id: "master-events", title: "Events", sheetTab: "" },
  // Interac inbox log — matching still writes Paid on Members / Donations / Vendors.
  { id: "payment-review-membership", title: "Payments", sheetTab: "Interac Log", source: "interac" },
  // Separate donor spreadsheet — auto-created if the "Donations" tab is missing.
  { id: "payment-review-donations", title: "Donations", sheetTab: "Donations", source: "donor" },
  // Not a row grid — rendered by its own panel. Backed by the "Membership Email"
  // tab that Membershipfollowup.gs reads via mbReadTemplate().
  { id: "email-membership-followup", title: "Follow-up Email", sheetTab: "Membership Email", source: "membership" },
];

/** Sheet tabs already claimed by another list above — excluded from the Events dropdown. */
export const NON_EVENT_TABS = new Set([
  ...DASHBOARD_LISTS.filter((l) => l.sheetTab).map((l) => l.sheetTab),
  "Vendor's Raw Data",
]);

export function listMeta(id: DashboardListId) {
  return DASHBOARD_LISTS.find((l) => l.id === id) ?? DASHBOARD_LISTS[0];
}
