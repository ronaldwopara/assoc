"use client";

import { useState } from "react";
import { ImagePlus, Loader2 } from "lucide-react";
import type { PopupCmsData } from "@/lib/popup-cms/types";
import { collectPopupImageUrls, normalizeFooterColor } from "@/lib/popup-cms/helpers";
import { UpgradeToolHeader, type UpgradeStatus } from "@/components/upgrade/upgrade-tool-header";
import {
  StepWizard,
  WizardChoices,
  WizardDone,
  WizardOption,
  WIZARD_INPUT,
  type WizardStep,
} from "@/components/ui/step-wizard";
import { cn } from "@/lib/utils";

const SWATCHES = [
  { label: "White", color: "#ffffff" },
  { label: "Cream", color: "#f6efe4" },
  { label: "Orange", color: "#f08a4b" },
  { label: "Black", color: "#111111" },
];

/** Uploads that were never saved are removed when replaced. */
async function deleteDraftPopupUrls(urls: string[], saved: PopupCmsData) {
  const savedUrls = new Set(collectPopupImageUrls(saved));
  const draft = [...new Set(urls.filter((u) => u && !savedUrls.has(u)))];
  if (!draft.length) return;
  await fetch("/api/upgrade/popup/media", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ urls: draft }),
  }).catch(() => undefined);
}

interface UpgradePopupEditorProps {
  data: PopupCmsData;
  savedData: PopupCmsData;
  setData: React.Dispatch<React.SetStateAction<PopupCmsData>>;
  saving: boolean;
  status: UpgradeStatus;
  setStatus: React.Dispatch<React.SetStateAction<UpgradeStatus>>;
  onSave: (next?: PopupCmsData) => Promise<boolean>;
  onBack: () => void;
  onHome: () => void;
  onLogout: () => void;
}

export function UpgradePopupEditor({ savedData, saving, status, setStatus, onSave, onBack, onHome, onLogout }: UpgradePopupEditorProps) {
  const [draft, setDraft] = useState<PopupCmsData>(savedData);
  const [round, setRound] = useState(0);
  const [done, setDone] = useState(false);
  const [uploading, setUploading] = useState(false);
  const set = (patch: Partial<PopupCmsData>) => setDraft((d) => ({ ...d, ...patch }));
  const footer = normalizeFooterColor(draft.footerColor);

  async function uploadFlyer(file: File) {
    const previous = draft.imageUrl;
    setUploading(true);
    setStatus({ type: "idle", message: "" });
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/upgrade/popup/upload", { method: "POST", body: form });
      const body = (await res.json()) as { imageUrl?: string; imageRatio?: number; error?: string };
      if (!res.ok || !body.imageUrl) {
        setStatus({ type: "error", message: body.error ?? "Upload failed" });
        return;
      }
      set({ imageUrl: body.imageUrl, imageRatio: body.imageRatio ?? 9 / 16 });
      if (previous) void deleteDraftPopupUrls([previous], savedData);
    } catch {
      setStatus({ type: "error", message: "Upload failed" });
    } finally {
      setUploading(false);
    }
  }

  const preview = (
    <div className="mx-auto max-w-56 overflow-hidden rounded-2xl border border-(--ink)/10 shadow-sm">
      {draft.imageUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={draft.imageUrl} alt="" className="block w-full" style={{ aspectRatio: draft.imageRatio || 9 / 16 }} />
      )}
      {draft.buttonLabel.trim() && (
        <div className="px-3 py-3" style={{ backgroundColor: footer }}>
          <span className="hero-cta-btn flex min-h-10 items-center justify-center px-3 text-sm font-semibold text-black">
            {draft.buttonLabel}
          </span>
        </div>
      )}
    </div>
  );

  const steps: WizardStep[] = [
    {
      key: "on",
      title: "Show a popup on the homepage?",
      hint: "It appears once per visit, near About Us.",
      content: (
        <WizardChoices>
          <WizardOption title="Yes, show it" selected={draft.enabled} onSelect={() => set({ enabled: true })} />
          <WizardOption title="No, hide it" selected={!draft.enabled} onSelect={() => set({ enabled: false })} />
        </WizardChoices>
      ),
    },
  ];
  if (draft.enabled) {
    steps.push(
      {
        key: "flyer",
        title: "Add the flyer",
        hint: "A tall picture works best.",
        ready: Boolean(draft.imageUrl),
        content: (
          <label className="group relative mx-auto block w-full max-w-64 cursor-pointer overflow-hidden rounded-2xl border-2 border-dashed border-(--ink)/20 bg-white transition hover:border-(--orange)">
            {draft.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={draft.imageUrl} alt="" className="block w-full" />
            ) : (
              <span className="flex aspect-9/16 flex-col items-center justify-center gap-2 text-base font-medium text-(--ink)/60">
                <ImagePlus className="size-8" aria-hidden /> Choose picture
              </span>
            )}
            {draft.imageUrl && !uploading && (
              <span className="absolute inset-x-0 bottom-0 bg-black/55 py-2 text-center text-sm font-semibold text-white">Change picture</span>
            )}
            {uploading && (
              <span className="absolute inset-0 grid place-items-center bg-white/70">
                <Loader2 className="size-7 animate-spin" aria-label="Uploading" />
              </span>
            )}
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
              className="sr-only"
              disabled={uploading}
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = "";
                if (file) void uploadFlyer(file);
              }}
            />
          </label>
        ),
      },
      {
        key: "button",
        title: "Add a button under it?",
        hint: "Optional. The words on the button, like “Register now”.",
        skippable: !draft.buttonLabel.trim(),
        content: <input autoFocus className={WIZARD_INPUT} value={draft.buttonLabel} onChange={(e) => set({ buttonLabel: e.target.value })} />,
      },
    );
    if (draft.buttonLabel.trim()) {
      steps.push(
        {
          key: "link",
          title: "Where should the button go?",
          hint: "A web address, or a page like /join.",
          ready: draft.buttonHref.trim().length > 0,
          content: (
            <input
              autoFocus
              inputMode="url"
              className={WIZARD_INPUT}
              value={draft.buttonHref}
              placeholder="/events"
              onChange={(e) => set({ buttonHref: e.target.value })}
            />
          ),
        },
        {
          key: "colour",
          title: "Pick a colour behind the button",
          content: (
            <div className="flex flex-wrap gap-3">
              {SWATCHES.map((s) => (
                <button
                  key={s.color}
                  type="button"
                  onClick={() => set({ footerColor: s.color })}
                  aria-pressed={footer === s.color}
                  className={cn(
                    "flex cursor-pointer flex-col items-center gap-1.5 rounded-xl border-2 p-2 text-sm font-medium text-(--ink)",
                    footer === s.color ? "border-(--orange)" : "border-transparent",
                  )}
                >
                  <span className="size-12 rounded-lg border border-(--ink)/15" style={{ backgroundColor: s.color }} />
                  {s.label}
                </button>
              ))}
              <label
                className={cn(
                  "flex cursor-pointer flex-col items-center gap-1.5 rounded-xl border-2 p-2 text-sm font-medium text-(--ink)",
                  SWATCHES.some((s) => s.color === footer) ? "border-transparent" : "border-(--orange)",
                )}
              >
                <input
                  type="color"
                  value={footer}
                  onChange={(e) => set({ footerColor: e.target.value })}
                  className="size-12 cursor-pointer rounded-lg border border-(--ink)/15 bg-white p-0.5"
                />
                Other
              </label>
            </div>
          ),
        },
      );
    }
    steps.push({ key: "check", title: "Here's how it will look", content: preview });
  }

  async function finish() {
    if (await onSave(draft)) setDone(true);
  }

  return (
    <div className="mt-8 space-y-8">
      <UpgradeToolHeader
        title="Popup"
        description="A flyer that pops up on the homepage."
        isDirty={false}
        saving={saving}
        status={{ type: "idle", message: "" }}
        onBack={onBack}
        onHome={onHome}
        onSave={() => {}}
        onLogout={onLogout}
        showSave={false}
      />
      {done ? (
        <WizardDone
          title={draft.enabled ? "The popup is live" : "The popup is hidden"}
          onAgain={() => {
            setDone(false);
            setRound((r) => r + 1);
            setStatus({ type: "idle", message: "" });
          }}
        >
          {draft.enabled && <div className="mt-4">{preview}</div>}
        </WizardDone>
      ) : (
        <StepWizard
          key={round}
          steps={steps}
          busy={uploading}
          onFinish={finish}
          finishLabel="Save"
          finishing={saving}
          status={status.type === "error" ? status : undefined}
        />
      )}
    </div>
  );
}
