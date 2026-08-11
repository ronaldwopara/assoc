/** localStorage keys + event for the site-wide staff tools FAB. */
export const STAFF_FAB_STORAGE_KEY = "asosc-staff-fab-hidden";
export const STAFF_FAB_PREFS_STORAGE_KEY = "asosc-staff-fab-prefs";
export const STAFF_FAB_CHANGE_EVENT = "asosc-staff-fab-change";

export type StaffFabPosition = "bottom-left" | "bottom-right";
export type StaffFabTrigger = "always" | "after-scroll";

export interface StaffFabPrefs {
  position: StaffFabPosition;
  trigger: StaffFabTrigger;
  /** Pixels scrolled before the fab appears — only used when trigger is "after-scroll". */
  scrollThreshold: number;
}

export const DEFAULT_STAFF_FAB_PREFS: StaffFabPrefs = {
  position: "bottom-left",
  trigger: "always",
  scrollThreshold: 400,
};

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

export function getStaffFabPrefs(): StaffFabPrefs {
  if (typeof window === "undefined") return DEFAULT_STAFF_FAB_PREFS;
  try {
    const raw = window.localStorage.getItem(STAFF_FAB_PREFS_STORAGE_KEY);
    if (!raw) return DEFAULT_STAFF_FAB_PREFS;
    const parsed = JSON.parse(raw) as Partial<StaffFabPrefs>;
    return {
      position: parsed.position === "bottom-right" ? "bottom-right" : "bottom-left",
      trigger: parsed.trigger === "after-scroll" ? "after-scroll" : "always",
      scrollThreshold:
        typeof parsed.scrollThreshold === "number" && parsed.scrollThreshold >= 0
          ? parsed.scrollThreshold
          : DEFAULT_STAFF_FAB_PREFS.scrollThreshold,
    };
  } catch {
    return DEFAULT_STAFF_FAB_PREFS;
  }
}

export function setStaffFabPrefs(prefs: Partial<StaffFabPrefs>) {
  if (typeof window === "undefined") return;
  const next = { ...getStaffFabPrefs(), ...prefs };
  try {
    window.localStorage.setItem(STAFF_FAB_PREFS_STORAGE_KEY, JSON.stringify(next));
  } catch {
    // private mode / blocked storage — ignore
  }
  window.dispatchEvent(new Event(STAFF_FAB_CHANGE_EVENT));
}
