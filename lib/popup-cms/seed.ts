import type { PopupCmsData } from "@/lib/popup-cms/types";

export const DEFAULT_POPUP_FOOTER_COLOR = "#ffffff";

export function buildSeedPopupCms(): PopupCmsData {
  return {
    version: 1,
    updatedAt: new Date(0).toISOString(),
    enabled: false,
    imageUrl: "",
    imageRatio: 9 / 16,
    buttonLabel: "",
    buttonHref: "",
    footerColor: DEFAULT_POPUP_FOOTER_COLOR,
  };
}
