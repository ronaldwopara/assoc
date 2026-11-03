/** Dashboard sidebar entries. Every row-grid list is a tab on the master sheet (lib/master-sheet.ts). */

import { MASTER_TABS, type MasterTabName } from "@/lib/master-sheet";

export type DashboardListId =
  | "overview"
  | "form-log"
  | "master-list"
  | "master-volunteer"
  | "master-vendor"
  | "master-newsletter"
  | "master-contact"
  | "master-registrations"
  | "payment-review-membership"
  | "payment-review-donations"
  | "invoices"
  | "emails"
  | "compose";

export const DASHBOARD_LISTS: Array<{
  id: DashboardListId;
  title: string;
  /** Master-sheet tab; empty for panels that aren't a row grid. */
  sheetTab: MasterTabName | "";
}> = [
  { id: "overview", title: "Overview", sheetTab: "" },
  // Every form that comes in, newest first, with push notifications.
  { id: "form-log", title: "Form log", sheetTab: MASTER_TABS.formLog },
  { id: "master-list", title: "Master List", sheetTab: MASTER_TABS.masterList },
  { id: "master-volunteer", title: "Volunteers", sheetTab: MASTER_TABS.volunteers },
  { id: "master-vendor", title: "Vendors", sheetTab: MASTER_TABS.vendors },
  { id: "master-newsletter", title: "Newsletter", sheetTab: MASTER_TABS.newsletter },
  { id: "master-contact", title: "Contact", sheetTab: MASTER_TABS.contact },
  { id: "master-registrations", title: "Event registrations", sheetTab: MASTER_TABS.registrations },
  // Own panel; rebuilt in the payments step.
  { id: "payment-review-membership", title: "Payments", sheetTab: MASTER_TABS.payments },
  { id: "payment-review-donations", title: "Donations", sheetTab: MASTER_TABS.donations },
  // Own panel: invoices and receipts, and writing a new one.
  { id: "invoices", title: "Invoices & receipts", sheetTab: "" },
  // Own panel: sending status, template previews, pending confirmations.
  { id: "emails", title: "Automatic emails", sheetTab: "" },
  // Own panel: write and send an email to lists.
  { id: "compose", title: "Send an email", sheetTab: "" },
];

export function listMeta(id: DashboardListId) {
  return DASHBOARD_LISTS.find((l) => l.id === id) ?? DASHBOARD_LISTS[0];
}
