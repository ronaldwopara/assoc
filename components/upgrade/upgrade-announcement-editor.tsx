"use client";

import { useState } from "react";
import type { AnnouncementCms, GalleryCmsData } from "@/lib/gallery-cms/types";
import { UpgradeToolHeader, type UpgradeStatus } from "@/components/upgrade/upgrade-tool-header";
import {
  StepWizard,
  WizardChoices,
  WizardDone,
  WizardOption,
  WIZARD_INPUT,
  type WizardStep,
} from "@/components/ui/step-wizard";

const SPEEDS = [
  { label: "Slow", seconds: 40 },
  { label: "Normal", seconds: 26 },
  { label: "Fast", seconds: 14 },
];

const nearestSpeed = (s: number) =>
  SPEEDS.reduce((best, x) => (Math.abs(x.seconds - s) < Math.abs(best.seconds - s) ? x : best)).seconds;

interface UpgradeAnnouncementEditorProps {
  data: GalleryCmsData;
  savedData: GalleryCmsData;
  setData: React.Dispatch<React.SetStateAction<GalleryCmsData>>;
  saving: boolean;
  status: UpgradeStatus;
  onSave: (next?: GalleryCmsData) => Promise<boolean>;
  onBack: () => void;
  onHome: () => void;
  onLogout: () => void;
}

export function UpgradeAnnouncementEditor({ savedData, saving, status, onSave, onBack, onHome, onLogout }: UpgradeAnnouncementEditorProps) {
  const [draft, setDraft] = useState<AnnouncementCms>(savedData.announcement);
  const [round, setRound] = useState(0);
  const [done, setDone] = useState(false);
  const set = (patch: Partial<AnnouncementCms>) => setDraft((d) => ({ ...d, ...patch }));

  const steps: WizardStep[] = [
    {
      key: "on",
      title: "Show the announcement bar?",
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
        key: "text",
        title: "What should it say?",
        ready: draft.text.trim().length > 0,
        content: <input autoFocus className={WIZARD_INPUT} value={draft.text} onChange={(e) => set({ text: e.target.value })} />,
      },
      {
        key: "link",
        title: "Should it link somewhere?",
        hint: "Optional. A web address, or a page like /join.",
        skippable: !draft.href.trim(),
        content: (
          <input
            autoFocus
            inputMode="url"
            className={WIZARD_INPUT}
            value={draft.href}
            placeholder="/events"
            onChange={(e) => set({ href: e.target.value })}
          />
        ),
      },
      {
        key: "speed",
        title: "How fast should it scroll?",
        content: (
          <WizardChoices>
            {SPEEDS.map((s) => (
              <WizardOption
                key={s.label}
                title={s.label}
                selected={nearestSpeed(draft.speedSeconds) === s.seconds}
                onSelect={() => set({ speedSeconds: s.seconds })}
              />
            ))}
          </WizardChoices>
        ),
      },
      {
        key: "direction",
        title: "Which way should it scroll?",
        content: (
          <WizardChoices>
            <WizardOption title="Left to right →" selected={draft.direction === "ltr"} onSelect={() => set({ direction: "ltr" })} />
            <WizardOption title="← Right to left" selected={draft.direction === "rtl"} onSelect={() => set({ direction: "rtl" })} />
          </WizardChoices>
        ),
      },
    );
  }

  async function finish() {
    if (await onSave({ ...savedData, announcement: draft })) setDone(true);
  }

  return (
    <div className="mt-8 space-y-8">
      <UpgradeToolHeader
        title="Announcement bar"
        description="The moving message along the top of the website."
        isDirty={false}
        saving={saving}
        status={done ? status : { type: "idle", message: "" }}
        onBack={onBack}
        onHome={onHome}
        onSave={() => {}}
        onLogout={onLogout}
        showSave={false}
      />
      {done ? (
        <WizardDone
          title={draft.enabled ? "The announcement is live" : "The announcement is hidden"}
          onAgain={() => {
            setDone(false);
            setRound((r) => r + 1);
          }}
        >
          {draft.enabled && <p>&ldquo;{draft.text}&rdquo;</p>}
        </WizardDone>
      ) : (
        <StepWizard key={round} steps={steps} onFinish={finish} finishLabel="Save" finishing={saving} status={status.type === "error" ? status : undefined} />
      )}
    </div>
  );
}
