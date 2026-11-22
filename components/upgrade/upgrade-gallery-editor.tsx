"use client";

import { useState } from "react";
import { ArrowDown, ArrowUp, ImagePlus, Loader2, Pencil, Plus, Trash2, X } from "lucide-react";
import {
  PREVIEW_SLOT_COUNT,
  type GalleryCmsData,
  type GalleryCmsImage,
  type GalleryCmsProgram,
  type GalleryCmsYearEntry,
} from "@/lib/gallery-cms/types";
import { collectGalleryImageUrls } from "@/lib/gallery-cms/helpers";
import { slugifyProgramTitle } from "@/lib/gallery-cms/slug";
import { UpgradeToolHeader, type UpgradeStatus } from "@/components/upgrade/upgrade-tool-header";
import { StepWizard, WizardChoices, WizardOption, WIZARD_INPUT, type WizardStep } from "@/components/ui/step-wizard";
import { cn } from "@/lib/utils";

const ICON_BTN =
  "inline-flex size-9 cursor-pointer items-center justify-center rounded-lg border border-(--ink)/15 bg-white text-(--ink) transition hover:bg-(--cream-light) disabled:cursor-not-allowed disabled:opacity-30";

const emptyImages = (): GalleryCmsImage[] => Array.from({ length: PREVIEW_SLOT_COUNT }, () => ({ src: "", ratio: 16 / 9 }));

function move<T>(list: T[], from: number, to: number): T[] {
  if (to < 0 || to >= list.length) return list;
  const next = [...list];
  const [it] = next.splice(from, 1);
  next.splice(to, 0, it);
  return next;
}

/** Uploads that were never saved are removed when abandoned or replaced. */
async function deleteDraftUrls(urls: string[], saved: GalleryCmsData) {
  const savedUrls = new Set(collectGalleryImageUrls(saved));
  const draft = [...new Set(urls.filter((u) => u && !savedUrls.has(u)))];
  if (!draft.length) return;
  await fetch("/api/upgrade/media", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ urls: draft }),
  }).catch(() => undefined);
}

type Editing =
  /** programIndex null = a new program. yearIndex null = a new year. */
  | { kind: "year"; programIndex: number | null; yearIndex: number | null }
  | { kind: "rename"; programIndex: number };

interface UpgradeGalleryEditorProps {
  data: GalleryCmsData;
  savedData: GalleryCmsData;
  setData: React.Dispatch<React.SetStateAction<GalleryCmsData>>;
  saving: boolean;
  status: UpgradeStatus;
  setStatus: React.Dispatch<React.SetStateAction<UpgradeStatus>>;
  onSave: (next?: GalleryCmsData) => Promise<boolean>;
  onBack: () => void;
  onHome: () => void;
  onLogout: () => void;
}

export function UpgradeGalleryEditor({ savedData, saving, status, setStatus, onSave, onBack, onHome, onLogout }: UpgradeGalleryEditorProps) {
  const [editing, setEditing] = useState<Editing | null>(null);
  const programs = savedData.programs;
  const save = (next: GalleryCmsProgram[]) => onSave({ ...savedData, programs: next });
  const open = (e: Editing) => {
    setStatus({ type: "idle", message: "" });
    setEditing(e);
  };

  if (editing?.kind === "year") {
    return (
      <div className="mt-8">
        <YearWizard
          programs={programs}
          programIndex={editing.programIndex}
          yearIndex={editing.yearIndex}
          saved={savedData}
          saving={saving}
          status={status}
          setStatus={setStatus}
          onCancel={() => setEditing(null)}
          onFinish={async (next) => {
            if (await save(next)) setEditing(null);
          }}
        />
      </div>
    );
  }

  if (editing?.kind === "rename") {
    const p = programs[editing.programIndex];
    return (
      <div className="mt-8">
        <RenameProgram
          title={p.title}
          saving={saving}
          status={status}
          onCancel={() => setEditing(null)}
          onFinish={async (title) => {
            const next = programs.map((x, i) =>
              i === editing.programIndex ? { ...x, title, slug: slugifyProgramTitle(title) || x.slug } : x,
            );
            if (await save(next)) setEditing(null);
          }}
        />
      </div>
    );
  }

  return (
    <div className="mt-8 space-y-6">
      <UpgradeToolHeader
        title="Gallery"
        description="Programs, their years, preview photos and album links."
        isDirty={false}
        saving={saving}
        status={status}
        onBack={onBack}
        onHome={onHome}
        onSave={() => {}}
        onLogout={onLogout}
        showSave={false}
      />

      <button
        type="button"
        onClick={() => open({ kind: "year", programIndex: null, yearIndex: null })}
        className="flex min-h-16 w-full cursor-pointer items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-(--ink)/20 text-base font-semibold text-(--ink)/75 transition hover:border-(--orange) hover:text-(--ink)"
      >
        <Plus className="size-5" aria-hidden /> Add a program
      </button>

      {programs.map((p, pi) => (
        <section key={`${p.slug}-${pi}`} className="rounded-2xl bg-white/70 p-4 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-semibold text-(--ink)">{p.title}</h2>
            <div className="flex items-center gap-2">
              <button type="button" className={ICON_BTN} aria-label={`Rename ${p.title}`} onClick={() => open({ kind: "rename", programIndex: pi })}>
                <Pencil className="size-4" aria-hidden />
              </button>
              <button type="button" className={ICON_BTN} aria-label="Move up" disabled={saving || pi === 0} onClick={() => void save(move(programs, pi, pi - 1))}>
                <ArrowUp className="size-4" aria-hidden />
              </button>
              <button
                type="button"
                className={ICON_BTN}
                aria-label="Move down"
                disabled={saving || pi === programs.length - 1}
                onClick={() => void save(move(programs, pi, pi + 1))}
              >
                <ArrowDown className="size-4" aria-hidden />
              </button>
              <button
                type="button"
                className={cn(ICON_BTN, "text-red-700")}
                aria-label={`Delete ${p.title}`}
                disabled={saving}
                onClick={() => {
                  if (!confirm(`Delete "${p.title}" and all its photos? This can't be undone.`)) return;
                  void save(programs.filter((_, i) => i !== pi));
                }}
              >
                <Trash2 className="size-4" aria-hidden />
              </button>
            </div>
          </div>

          <ul className="mt-3 space-y-2">
            {p.years.map((y, yi) => {
              const photos = y.images.filter((im) => im.src);
              return (
                <li key={`${y.year}-${yi}`} className="flex items-center gap-3 rounded-xl bg-white px-3 py-2.5">
                  <div className="flex shrink-0 -space-x-2">
                    {photos.slice(0, 3).map((im) => (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img key={im.src} src={im.src} alt="" className="size-9 rounded-md border-2 border-white object-cover" />
                    ))}
                    {photos.length === 0 && <span className="size-9 rounded-md bg-(--cream-light)" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-(--ink)">{y.year}</p>
                    <p className="text-xs text-(--ink)/55">
                      {photos.length} photo{photos.length === 1 ? "" : "s"}
                      {y.albumUrl ? " · album linked" : ""}
                    </p>
                  </div>
                  <button type="button" className={ICON_BTN} aria-label={`Edit ${y.year}`} onClick={() => open({ kind: "year", programIndex: pi, yearIndex: yi })}>
                    <Pencil className="size-4" aria-hidden />
                  </button>
                  <button
                    type="button"
                    className={cn(ICON_BTN, "text-red-700")}
                    aria-label={`Delete ${y.year}`}
                    disabled={saving || p.years.length === 1}
                    onClick={() => {
                      if (!confirm(`Delete ${y.year} and its photos? This can't be undone.`)) return;
                      void save(programs.map((x, i) => (i === pi ? { ...x, years: x.years.filter((_, j) => j !== yi) } : x)));
                    }}
                  >
                    <Trash2 className="size-4" aria-hidden />
                  </button>
                </li>
              );
            })}
          </ul>
          <button
            type="button"
            onClick={() => open({ kind: "year", programIndex: pi, yearIndex: null })}
            className="mt-2 inline-flex min-h-10 cursor-pointer items-center gap-1.5 rounded-lg px-2 text-sm font-semibold text-(--ink)/70 hover:bg-(--ink)/5 hover:text-(--ink)"
          >
            <Plus className="size-4" aria-hidden /> Add a year
          </button>
        </section>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------- add a program / add or edit a year

function YearWizard({
  programs,
  programIndex,
  yearIndex,
  saved,
  saving,
  status,
  setStatus,
  onCancel,
  onFinish,
}: {
  programs: GalleryCmsProgram[];
  programIndex: number | null;
  yearIndex: number | null;
  saved: GalleryCmsData;
  saving: boolean;
  status: UpgradeStatus;
  setStatus: (s: UpgradeStatus) => void;
  onCancel: () => void;
  onFinish: (programs: GalleryCmsProgram[]) => void;
}) {
  const program = programIndex === null ? null : programs[programIndex];
  const existing: GalleryCmsYearEntry | null = program && yearIndex !== null ? program.years[yearIndex] : null;
  const takenYears = new Set((program?.years ?? []).filter((_, i) => i !== yearIndex).map((y) => y.year));

  const [title, setTitle] = useState(program?.title ?? "");
  const thisYear = new Date().getFullYear();
  const yearChoices = [thisYear, thisYear - 1, thisYear - 2].map(String).filter((y) => !takenYears.has(y));
  const [year, setYear] = useState(existing?.year ?? yearChoices[0] ?? "");
  const [otherYear, setOtherYear] = useState(existing && !yearChoices.includes(existing.year) ? existing.year : "");
  const usingOther = !yearChoices.includes(year);
  const [images, setImages] = useState<GalleryCmsImage[]>(existing?.images ?? emptyImages());
  const [albumUrl, setAlbumUrl] = useState(existing?.albumUrl ?? "");
  const [uploadingSlot, setUploadingSlot] = useState<number | null>(null);

  const slug = program?.slug ?? slugifyProgramTitle(title);
  const yearLabel = usingOther ? otherYear.trim() : year;
  const yearClash = takenYears.has(yearLabel);

  async function upload(slot: number, file: File) {
    const previous = images[slot]?.src;
    setUploadingSlot(slot);
    setStatus({ type: "idle", message: "" });
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("programSlug", slug || "program");
      form.append("year", yearLabel);
      form.append("slot", String(slot));
      const res = await fetch("/api/upgrade/upload", { method: "POST", body: form });
      const body = (await res.json()) as { src?: string; ratio?: number; error?: string };
      if (!res.ok || !body.src) {
        setStatus({ type: "error", message: body.error ?? "Upload failed" });
        return;
      }
      setImages((list) => list.map((im, i) => (i === slot ? { src: body.src!, ratio: body.ratio ?? 16 / 9 } : im)));
      if (previous) void deleteDraftUrls([previous], saved);
    } catch {
      setStatus({ type: "error", message: "Upload failed" });
    } finally {
      setUploadingSlot(null);
    }
  }

  const steps: WizardStep[] = [];
  if (!program) {
    steps.push({
      key: "title",
      title: "What's the program called?",
      ready: title.trim().length > 0,
      content: <input autoFocus className={WIZARD_INPUT} value={title} onChange={(e) => setTitle(e.target.value)} />,
    });
  }
  steps.push(
    {
      key: "year",
      title: "Which year?",
      ready: Boolean(yearLabel) && !yearClash,
      content: (
        <WizardChoices>
          {yearChoices.map((y) => (
            <WizardOption key={y} title={y} selected={year === y} onSelect={() => setYear(y)} />
          ))}
          <WizardOption title="Another year" selected={usingOther} onSelect={() => setYear("")} />
          {usingOther && (
            <input
              autoFocus
              inputMode="numeric"
              className={WIZARD_INPUT}
              value={otherYear}
              placeholder="2019"
              onChange={(e) => setOtherYear(e.target.value)}
            />
          )}
          {yearClash && <p className="text-sm text-red-700">That year is already there.</p>}
        </WizardChoices>
      ),
    },
    {
      key: "photos",
      title: "Add up to 6 photos",
      hint: "These show as the preview on the gallery page.",
      content: (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {images.map((im, slot) => (
            <div key={slot} className="relative">
              <label className="relative block aspect-video cursor-pointer overflow-hidden rounded-xl border-2 border-dashed border-(--ink)/20 bg-white transition hover:border-(--orange)">
                {im.src ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={im.src} alt="" className="size-full object-cover" />
                ) : (
                  <span className="flex size-full items-center justify-center text-(--ink)/45">
                    <ImagePlus className="size-6" aria-hidden />
                    <span className="sr-only">Add photo {slot + 1}</span>
                  </span>
                )}
                {uploadingSlot === slot && (
                  <span className="absolute inset-0 grid place-items-center bg-white/70">
                    <Loader2 className="size-6 animate-spin" aria-label="Uploading" />
                  </span>
                )}
                <input
                  type="file"
                  accept="image/*"
                  className="sr-only"
                  disabled={uploadingSlot !== null}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    e.target.value = "";
                    if (f) void upload(slot, f);
                  }}
                />
              </label>
              {im.src && uploadingSlot !== slot && (
                <button
                  type="button"
                  aria-label={`Remove photo ${slot + 1}`}
                  onClick={() => {
                    void deleteDraftUrls([im.src], saved);
                    setImages((list) => list.map((x, i) => (i === slot ? { src: "", ratio: 16 / 9 } : x)));
                  }}
                  className="absolute right-1.5 top-1.5 grid size-7 cursor-pointer place-items-center rounded-full bg-black/60 text-white hover:bg-black/80"
                >
                  <X className="size-4" aria-hidden />
                </button>
              )}
            </div>
          ))}
        </div>
      ),
    },
    {
      key: "album",
      title: "Link the full Google Photos album?",
      hint: "Optional. Paste the album's share link.",
      skippable: !albumUrl.trim(),
      content: (
        <input
          autoFocus
          inputMode="url"
          className={WIZARD_INPUT}
          value={albumUrl}
          placeholder="https://photos.google.com/share/…"
          onChange={(e) => setAlbumUrl(e.target.value)}
        />
      ),
    },
  );

  function finish() {
    const entry: GalleryCmsYearEntry = { year: yearLabel, albumUrl: albumUrl.trim(), images };
    if (!program) {
      onFinish([...programs, { slug, title: title.trim(), years: [entry] }]);
      return;
    }
    onFinish(
      programs.map((p, i) =>
        i !== programIndex
          ? p
          : { ...p, years: yearIndex === null ? [entry, ...p.years] : p.years.map((y, j) => (j === yearIndex ? entry : y)) },
      ),
    );
  }

  return (
    <StepWizard
      steps={steps}
      label={program ? `${program.title}${existing ? ` ${existing.year}` : ""}` : "New program"}
      busy={uploadingSlot !== null}
      onCancel={() => {
        const kept = new Set(existing?.images.map((im) => im.src));
        void deleteDraftUrls(
          images.map((im) => im.src).filter((src) => !kept.has(src)),
          saved,
        );
        onCancel();
      }}
      onFinish={finish}
      finishLabel="Save"
      finishing={saving}
      status={status.type === "error" ? status : undefined}
    />
  );
}

function RenameProgram({
  title: initial,
  saving,
  status,
  onCancel,
  onFinish,
}: {
  title: string;
  saving: boolean;
  status: UpgradeStatus;
  onCancel: () => void;
  onFinish: (title: string) => void;
}) {
  const [title, setTitle] = useState(initial);
  return (
    <StepWizard
      steps={[
        {
          key: "title",
          title: "Rename this program",
          ready: title.trim().length > 0,
          content: <input autoFocus className={WIZARD_INPUT} value={title} onChange={(e) => setTitle(e.target.value)} />,
        },
      ]}
      onCancel={onCancel}
      onFinish={() => onFinish(title.trim())}
      finishLabel="Save"
      finishing={saving}
      status={status.type === "error" ? status : undefined}
    />
  );
}
