/** Dashboard list ids — each maps to a tab in the ASOSC master spreadsheet. */

export type DashboardListId =
  | "master-list"
  | "master-volunteer"
  | "master-vendor"
  | "master-guests"
  | "master-newsletter"
  | "master-members"
  | "master-events";

export const DASHBOARD_LISTS: Array<{
  id: DashboardListId;
  title: string;
  /** Exact sheet tab name; empty for lists whose tab is picked dynamically (Events). */
  sheetTab: string;
}> = [
  { id: "master-list", title: "Master List", sheetTab: "Master List" },
  { id: "master-volunteer", title: "Volunteers", sheetTab: "Volunteers" },
  { id: "master-vendor", title: "Vendors", sheetTab: "Vendors" },
  { id: "master-guests", title: "Guests", sheetTab: "Guests" },
  { id: "master-newsletter", title: "Newsletter", sheetTab: "Newsletter" },
  { id: "master-members", title: "Members", sheetTab: "ASOSC Membership Form 2025" },
  { id: "master-events", title: "Events", sheetTab: "" },
];

/** Sheet tabs already claimed by another list above — excluded from the Events dropdown. */
export const NON_EVENT_TABS = new Set([
  ...DASHBOARD_LISTS.filter((l) => l.sheetTab).map((l) => l.sheetTab),
  "Vendor's Raw Data",
]);

export function listMeta(id: DashboardListId) {
  return DASHBOARD_LISTS.find((l) => l.id === id) ?? DASHBOARD_LISTS[0];
}
