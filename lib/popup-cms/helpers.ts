import type { PopupCmsData } from "@/lib/popup-cms/types";
import { DEFAULT_POPUP_FOOTER_COLOR } from "@/lib/popup-cms/seed";

const HEX_COLOR = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

export function normalizeFooterColor(value: unknown, fallback = DEFAULT_POPUP_FOOTER_COLOR): string {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim();
  if (!HEX_COLOR.test(trimmed)) return fallback;
  if (trimmed.length === 4) {
    const [, r, g, b] = trimmed;
    return `#${r}${r}${g}${g}${b}${b}`.toLowerCase();
  }
  return trimmed.toLowerCase();
}

export function normalizePopupCmsData(
  input: unknown,
  fallback?: PopupCmsData,
): PopupCmsData {
  const defaults = fallback ?? {
    version: 1 as const,
    updatedAt: new Date(0).toISOString(),
    enabled: false,
    imageUrl: "",
    imageRatio: 9 / 16,
    buttonLabel: "",
    buttonHref: "",
    footerColor: DEFAULT_POPUP_FOOTER_COLOR,
  };

  if (!input || typeof input !== "object") return defaults;

  const raw = input as Partial<PopupCmsData>;
  const imageRatio =
    typeof raw.imageRatio === "number" && raw.imageRatio > 0
      ? raw.imageRatio
      : defaults.imageRatio;

  return {
    version: 1,
    updatedAt:
      typeof raw.updatedAt === "string" ? raw.updatedAt : defaults.updatedAt,
    enabled: typeof raw.enabled === "boolean" ? raw.enabled : defaults.enabled,
    imageUrl: typeof raw.imageUrl === "string" ? raw.imageUrl.trim() : defaults.imageUrl,
    imageRatio,
    buttonLabel:
      typeof raw.buttonLabel === "string" ? raw.buttonLabel.trim() : defaults.buttonLabel,
    buttonHref:
      typeof raw.buttonHref === "string" ? raw.buttonHref.trim() : defaults.buttonHref,
    footerColor: normalizeFooterColor(raw.footerColor, defaults.footerColor),
  };
}

export function isPopupReady(data: PopupCmsData): boolean {
  return data.enabled && data.imageUrl.trim().length > 0;
}

export function collectPopupImageUrls(data: PopupCmsData): string[] {
  return data.imageUrl ? [data.imageUrl] : [];
}
