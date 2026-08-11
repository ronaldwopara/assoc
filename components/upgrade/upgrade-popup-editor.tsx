"use client";

import { useMemo, useState } from "react";
import type { PopupCmsData } from "@/lib/popup-cms/types";
import {
  collectPopupImageUrls,
  normalizeFooterColor,
} from "@/lib/popup-cms/helpers";
import { DEFAULT_POPUP_FOOTER_COLOR } from "@/lib/popup-cms/seed";
import {
  UpgradeToolHeader,
  useUpgradeDirtyGuard,
  type UpgradeStatus,
} from "@/components/upgrade/upgrade-tool-header";

function collectDraftPopupUrls(urls: string[], saved: PopupCmsData): string[] {
  const savedUrls = new Set(collectPopupImageUrls(saved));
  return [...new Set(urls.filter((url) => url && !savedUrls.has(url)))];
}

async function deleteDraftPopupUrls(urls: string[], saved: PopupCmsData) {
  const draftUrls = collectDraftPopupUrls(urls, saved);
  if (draftUrls.length === 0) return;
  try {
    await fetch("/api/upgrade/popup/media", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ urls: draftUrls }),
    });
  } catch {
    // Save-time cleanup is the safety net for published assets.
  }
}

interface UpgradePopupEditorProps {
  data: PopupCmsData;
  savedData: PopupCmsData;
  setData: React.Dispatch<React.SetStateAction<PopupCmsData>>;
  saving: boolean;
  status: UpgradeStatus;
  setStatus: React.Dispatch<React.SetStateAction<UpgradeStatus>>;
  onSave: () => void;
  onBack: () => void;
  onHome: () => void;
  onLogout: () => void;
}

export function UpgradePopupEditor({
  data,
  savedData,
  setData,
  saving,
  status,
  setStatus,
  onSave,
  onBack,
  onHome,
  onLogout,
}: UpgradePopupEditorProps) {
  const [uploading, setUploading] = useState(false);

  const isDirty = useMemo(
    () => JSON.stringify(data) !== JSON.stringify(savedData),
    [data, savedData],
  );
  useUpgradeDirtyGuard(isDirty);

  const uploadFlyer = async (file: File) => {
    const previousUrl = data.imageUrl;
    setUploading(true);
    setStatus({ type: "idle", message: "" });
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/upgrade/popup/upload", {
        method: "POST",
        body: form,
      });
      const body = (await res.json()) as {
        imageUrl?: string;
        imageRatio?: number;
        error?: string;
      };
      if (!res.ok || !body.imageUrl) {
        setStatus({ type: "error", message: body.error ?? "Upload failed" });
        return;
      }
      setData((prev) => ({
        ...prev,
        imageUrl: body.imageUrl!,
        imageRatio: body.imageRatio ?? 9 / 16,
      }));
      if (previousUrl) {
        void deleteDraftPopupUrls([previousUrl], savedData);
      }
      setStatus({
        type: "ok",
        message: "Flyer uploaded. Click Save to publish.",
      });
    } catch {
      setStatus({ type: "error", message: "Upload failed" });
    } finally {
      setUploading(false);
    }
  };

  const clearFlyer = () => {
    if (!data.imageUrl) return;
    if (!confirm("Remove the current flyer image?")) return;
    const removed = data.imageUrl;
    setData((prev) => ({ ...prev, imageUrl: "", imageRatio: 9 / 16 }));
    void deleteDraftPopupUrls([removed], savedData);
  };

  const previewRatio = data.imageRatio > 0 ? data.imageRatio : 9 / 16;
  const footerColor = normalizeFooterColor(data.footerColor);

  return (
    <div className="mt-8 space-y-6">
      <UpgradeToolHeader
        title="Popup"
        description="Homepage flyer shown once per session after visitors scroll into About Us. Save to publish; replaced images are removed from Cloudinary."
        isDirty={isDirty}
        saving={saving}
        status={status}
        onBack={onBack}
        onHome={onHome}
        onSave={onSave}
        onLogout={onLogout}
      />

      <div className="space-y-5 rounded-2xl bg-white/70 p-5 sm:p-6">
        <div>
          <h2 className="text-lg font-semibold text-(--ink)">Homepage popup</h2>
          <p className="mt-1 text-sm text-(--ink)/65">
            Upload a portrait flyer (9:16 or similar). PNG, JPEG, or WebP — max 12MB.
          </p>
        </div>

        <div className="rounded-xl border border-(--ink)/10 bg-(--cream-light)/80 px-4 py-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-medium text-(--ink)">Show on homepage</p>
              <p className="mt-0.5 text-xs text-(--ink)/55">
                When on, visitors see this flyer after scrolling into About Us. When off, it stays
                hidden.
              </p>
            </div>
            <div
              className="inline-flex rounded-lg border border-(--ink)/15 bg-white p-0.5"
              role="group"
              aria-label="Show on homepage"
            >
              <button
                type="button"
                className="rounded-md px-3 py-1.5 text-sm font-medium transition"
                style={{
                  background: data.enabled ? "var(--orange)" : "transparent",
                  color: data.enabled ? "#111" : "var(--ink)",
                }}
                aria-pressed={data.enabled}
                onClick={() => setData((prev) => ({ ...prev, enabled: true }))}
              >
                On
              </button>
              <button
                type="button"
                className="rounded-md px-3 py-1.5 text-sm font-medium transition"
                style={{
                  background: !data.enabled ? "rgba(47,43,40,0.1)" : "transparent",
                  color: "var(--ink)",
                }}
                aria-pressed={!data.enabled}
                onClick={() => setData((prev) => ({ ...prev, enabled: false }))}
              >
                Off
              </button>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          <label className="inline-flex cursor-pointer items-center justify-center rounded-lg bg-(--orange) px-4 py-2 text-sm font-semibold text-black">
            {uploading ? "Uploading…" : data.imageUrl ? "Replace flyer" : "Upload flyer"}
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
              className="sr-only"
              disabled={uploading}
              onChange={(event) => {
                const file = event.target.files?.[0];
                event.target.value = "";
                if (file) void uploadFlyer(file);
              }}
            />
          </label>
          {data.imageUrl && (
            <button
              type="button"
              className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm font-medium text-red-800"
              onClick={clearFlyer}
            >
              Clear image
            </button>
          )}
        </div>

        <label className="block text-sm font-medium text-(--ink)">
          Button label
          <input
            value={data.buttonLabel}
            placeholder="Learn more"
            onChange={(event) =>
              setData((prev) => ({ ...prev, buttonLabel: event.target.value }))
            }
            className="mt-2 w-full rounded-lg border border-(--ink)/15 bg-white px-3 py-2.5 text-base outline-none focus:border-(--orange)"
          />
        </label>

        <label className="block text-sm font-medium text-(--ink)">
          Button link
          <input
            type="text"
            inputMode="url"
            autoComplete="url"
            value={data.buttonHref}
            placeholder="https://example.com/event or /join"
            onChange={(event) =>
              setData((prev) => ({ ...prev, buttonHref: event.target.value }))
            }
            className="mt-2 w-full rounded-lg border border-(--ink)/15 bg-white px-3 py-2.5 text-base outline-none focus:border-(--orange)"
          />
          <span className="mt-1.5 block text-xs font-normal text-(--ink)/55">
            External or on-site path. Shown in the footer below the flyer — not over the image.
          </span>
        </label>

        <div>
          <p className="text-sm font-medium text-(--ink)">Footer color</p>
          <p className="mt-0.5 text-xs text-(--ink)/55">
            Background behind the button strip under the flyer.
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <input
              type="color"
              value={footerColor}
              aria-label="Footer color"
              onChange={(event) =>
                setData((prev) => ({
                  ...prev,
                  footerColor: normalizeFooterColor(event.target.value),
                }))
              }
              className="h-11 w-14 cursor-pointer rounded-lg border border-(--ink)/15 bg-white p-1"
            />
            <input
              type="text"
              value={data.footerColor}
              spellCheck={false}
              placeholder={DEFAULT_POPUP_FOOTER_COLOR}
              onChange={(event) =>
                setData((prev) => ({ ...prev, footerColor: event.target.value }))
              }
              onBlur={() =>
                setData((prev) => ({
                  ...prev,
                  footerColor: normalizeFooterColor(prev.footerColor),
                }))
              }
              className="w-32 rounded-lg border border-(--ink)/15 bg-white px-3 py-2.5 font-mono text-sm outline-none focus:border-(--orange)"
            />
            <button
              type="button"
              className="rounded-lg border border-(--ink)/20 px-3 py-2 text-sm font-medium text-(--ink)"
              onClick={() =>
                setData((prev) => ({
                  ...prev,
                  footerColor: DEFAULT_POPUP_FOOTER_COLOR,
                }))
              }
            >
              Reset white
            </button>
          </div>
        </div>
      </div>

      {data.imageUrl && (
        <div className="rounded-2xl bg-white/70 p-5 sm:p-6">
          <h3 className="text-sm font-medium text-(--ink)">Preview</h3>
          <div className="flyer-popup-preview mx-auto mt-4 max-w-xs">
            <div
              className="flyer-popup-preview__image-wrap overflow-hidden rounded-t-2xl bg-(--cream)"
              style={{ aspectRatio: previewRatio }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={data.imageUrl}
                alt="Flyer preview"
                className="h-full w-full object-contain"
              />
            </div>
            <div
              className="flyer-popup-preview__footer rounded-b-2xl border border-t border-(--ink)/10 px-4 py-4"
              style={{ backgroundColor: footerColor }}
            >
              {data.buttonLabel.trim() ? (
                <span className="hero-cta-btn inline-flex min-h-11 w-full cursor-default items-center justify-center px-4 text-sm font-semibold text-black">
                  {data.buttonLabel}
                </span>
              ) : (
                <span className="block text-center text-sm text-(--ink)/45">
                  Add a button label
                </span>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
