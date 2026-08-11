import type { PopupCmsData } from "@/lib/popup-cms/types";
import { popupCampaignId } from "@/lib/popup-cms/helpers";

export const POPUP_DISMISS_STORAGE_KEY = "asosc_popup_dismissed";

type DismissRecord = { id: string };

function readDismissRecord(): DismissRecord | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(POPUP_DISMISS_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as DismissRecord;
    return typeof parsed.id === "string" ? parsed : null;
  } catch {
    return null;
  }
}

export function isPopupDismissedThisSession(data: PopupCmsData): boolean {
  const record = readDismissRecord();
  if (!record) return false;
  return record.id === popupCampaignId(data);
}

export function dismissPopupForSession(data: PopupCmsData): void {
  if (typeof window === "undefined") return;
  const record: DismissRecord = { id: popupCampaignId(data) };
  window.sessionStorage.setItem(POPUP_DISMISS_STORAGE_KEY, JSON.stringify(record));
}
