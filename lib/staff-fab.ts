/** localStorage key + event for the site-wide staff tools FAB. */
export const STAFF_FAB_STORAGE_KEY = "asosc-staff-fab-hidden";
export const STAFF_FAB_CHANGE_EVENT = "asosc-staff-fab-change";

export function isStaffFabHidden(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(STAFF_FAB_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

export function setStaffFabHidden(hidden: boolean) {
  if (typeof window === "undefined") return;
  try {
    if (hidden) {
      window.localStorage.setItem(STAFF_FAB_STORAGE_KEY, "1");
    } else {
      window.localStorage.removeItem(STAFF_FAB_STORAGE_KEY);
    }
  } catch {
    // private mode / blocked storage — ignore
  }
  window.dispatchEvent(new Event(STAFF_FAB_CHANGE_EVENT));
}
