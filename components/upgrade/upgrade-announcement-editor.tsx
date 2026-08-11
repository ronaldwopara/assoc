"use client";

import { useMemo } from "react";
import type { GalleryCmsData } from "@/lib/gallery-cms/types";
import {
  ANNOUNCEMENT_SPEED_MAX,
  ANNOUNCEMENT_SPEED_MIN,
} from "@/lib/gallery-cms/helpers";
import {
  UpgradeToolHeader,
  useUpgradeDirtyGuard,
  type UpgradeStatus,
} from "@/components/upgrade/upgrade-tool-header";

interface UpgradeAnnouncementEditorProps {
  data: GalleryCmsData;
  savedData: GalleryCmsData;
  setData: React.Dispatch<React.SetStateAction<GalleryCmsData>>;
  saving: boolean;
  status: UpgradeStatus;
  onSave: () => void;
  onBack: () => void;
  onHome: () => void;
  onLogout: () => void;
}

export function UpgradeAnnouncementEditor({
  data,
  savedData,
  setData,
  saving,
  status,
  onSave,
  onBack,
  onHome,
  onLogout,
}: UpgradeAnnouncementEditorProps) {
  const isDirty = useMemo(
    () => JSON.stringify(data) !== JSON.stringify(savedData),
    [data, savedData],
  );
  useUpgradeDirtyGuard(isDirty);

  return (
    <div className="mt-8 space-y-6">
      <UpgradeToolHeader
        title="Announcement bar"
        description="Edit the site-wide announcement message and optional link. Changes go live after Save."
        isDirty={isDirty}
        saving={saving}
        status={status}
        onBack={onBack}
        onHome={onHome}
        onSave={onSave}
        onLogout={onLogout}
      />

      <div className="space-y-4 rounded-2xl bg-white/70 p-5 sm:p-6">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-lg font-semibold text-(--ink)">Announcement bar</h2>
          <label className="inline-flex cursor-pointer items-center gap-2 text-sm font-medium text-(--ink)">
            <input
              type="checkbox"
              checked={data.announcement.enabled}
              onChange={(event) =>
                setData((prev) => ({
                  ...prev,
                  announcement: { ...prev.announcement, enabled: event.target.checked },
                }))
              }
              className="h-4 w-4 accent-(--orange)"
            />
            Enabled
          </label>
        </div>
        <label className="block text-sm font-medium text-(--ink)">
          Message
          <input
            value={data.announcement.text}
            placeholder="Free Shipping Canada-Wide $75+"
            onChange={(event) =>
              setData((prev) => ({
                ...prev,
                announcement: { ...prev.announcement, text: event.target.value },
              }))
            }
            className="mt-2 w-full rounded-lg border border-(--ink)/15 bg-white px-3 py-2.5 text-base outline-none focus:border-(--orange)"
          />
        </label>
        <label className="block text-sm font-medium text-(--ink)">
          Link (optional)
          <input
            type="text"
            inputMode="url"
            autoComplete="url"
            value={data.announcement.href}
            placeholder="https://example.com/event or /join"
            onChange={(event) =>
              setData((prev) => ({
                ...prev,
                announcement: { ...prev.announcement, href: event.target.value },
              }))
            }
            className="mt-2 w-full rounded-lg border border-(--ink)/15 bg-white px-3 py-2.5 text-base outline-none focus:border-(--orange)"
          />
          <span className="mt-1.5 block text-xs font-normal text-(--ink)/55">
            Any web address works — an external site, or a path on this site like /about.
          </span>
        </label>

        <label className="block text-sm font-medium text-(--ink)">
          Speed
          <span className="ml-2 font-normal text-(--ink)/55">
            {data.announcement.speedSeconds}s per loop (lower = faster)
          </span>
          <input
            type="range"
            min={ANNOUNCEMENT_SPEED_MIN}
            max={ANNOUNCEMENT_SPEED_MAX}
            step={1}
            value={data.announcement.speedSeconds}
            onChange={(event) =>
              setData((prev) => ({
                ...prev,
                announcement: {
                  ...prev.announcement,
                  speedSeconds: Number(event.target.value),
                },
              }))
            }
            className="mt-2 w-full accent-(--orange)"
          />
        </label>

        <div className="flex flex-wrap items-center gap-6">
          <label className="block text-sm font-medium text-(--ink)">
            Direction
            <select
              value={data.announcement.direction}
              onChange={(event) =>
                setData((prev) => ({
                  ...prev,
                  announcement: {
                    ...prev.announcement,
                    direction: event.target.value === "rtl" ? "rtl" : "ltr",
                  },
                }))
              }
              className="mt-2 block rounded-lg border border-(--ink)/15 bg-white px-3 py-2.5 text-base outline-none focus:border-(--orange)"
            >
              <option value="ltr">Left to right</option>
              <option value="rtl">Right to left</option>
            </select>
          </label>

          <label className="inline-flex cursor-pointer items-center gap-2 text-sm font-medium text-(--ink)">
            <input
              type="checkbox"
              checked={data.announcement.pauseOnHover}
              onChange={(event) =>
                setData((prev) => ({
                  ...prev,
                  announcement: {
                    ...prev.announcement,
                    pauseOnHover: event.target.checked,
                  },
                }))
              }
              className="h-4 w-4 accent-(--orange)"
            />
            Pause on hover / touch
          </label>
        </div>
      </div>
    </div>
  );
}
