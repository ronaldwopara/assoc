"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronDown } from "lucide-react";
import {
  PREVIEW_SLOT_COUNT,
  type GalleryCmsData,
  type GalleryCmsProgram,
  type GalleryCmsYearEntry,
} from "@/lib/gallery-cms/types";
import { collectGalleryImageUrls } from "@/lib/gallery-cms/helpers";
import { slugifyProgramTitle } from "@/lib/gallery-cms/slug";
import {
  UpgradeToolHeader,
  useUpgradeDirtyGuard,
  type UpgradeStatus,
} from "@/components/upgrade/upgrade-tool-header";

function emptyYear(year: string): GalleryCmsYearEntry {
  return {
    year,
    albumUrl: "",
    images: Array.from({ length: PREVIEW_SLOT_COUNT }, () => ({
      src: "",
      ratio: 16 / 9,
    })),
  };
}

function emptyProgram(): GalleryCmsProgram {
  const title = "New Program";
  return {
    slug: slugifyProgramTitle(title),
    title,
    years: [emptyYear(String(new Date().getFullYear()))],
  };
}

function collectDraftPreviewUrls(urls: string[], saved: GalleryCmsData): string[] {
  const savedUrls = new Set(collectGalleryImageUrls(saved));
  return [...new Set(urls.filter((url) => url && !savedUrls.has(url)))];
}

async function deleteDraftCloudinaryUrls(urls: string[], saved: GalleryCmsData) {
  const draftUrls = collectDraftPreviewUrls(urls, saved);
  if (draftUrls.length === 0) return;
  try {
    await fetch("/api/upgrade/media", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ urls: draftUrls }),
    });
  } catch {
    // Save-time cleanup is the safety net for published assets.
  }
}

interface UpgradeGalleryEditorProps {
  data: GalleryCmsData;
  savedData: GalleryCmsData;
  setData: React.Dispatch<React.SetStateAction<GalleryCmsData>>;
  saving: boolean;
  status: UpgradeStatus;
  setStatus: React.Dispatch<React.SetStateAction<UpgradeStatus>>;
  onSave: () => void;
  onBack: () => void;
  onHome: () => void;
  onLogout: () => void;
}

export function UpgradeGalleryEditor({
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
}: UpgradeGalleryEditorProps) {
  const [programIndex, setProgramIndex] = useState(0);
  const [yearIndex, setYearIndex] = useState(0);
  const [yearPickerOpen, setYearPickerOpen] = useState(false);
  const [uploadingSlot, setUploadingSlot] = useState<number | null>(null);

  const program = data.programs[programIndex] ?? null;
  const year = program?.years[yearIndex] ?? null;

  const isDirty = useMemo(
    () => JSON.stringify(data) !== JSON.stringify(savedData),
    [data, savedData],
  );
  useUpgradeDirtyGuard(isDirty);

  useEffect(() => {
    setYearPickerOpen(false);
  }, [program?.slug]);

  useEffect(() => {
    if (!program) return;
    if (yearIndex >= program.years.length) setYearIndex(0);
  }, [program, yearIndex]);

  const yearOptions = useMemo(() => program?.years ?? [], [program]);

  const updateProgram = useCallback(
    (updater: (program: GalleryCmsProgram) => GalleryCmsProgram) => {
      setData((prev) => {
        const programs = prev.programs.map((item, index) =>
          index === programIndex ? updater(item) : item,
        );
        return { ...prev, programs };
      });
    },
    [programIndex, setData],
  );

  const updateYear = useCallback(
    (updater: (entry: GalleryCmsYearEntry) => GalleryCmsYearEntry) => {
      updateProgram((prog) => ({
        ...prog,
        years: prog.years.map((item, index) =>
          index === yearIndex ? updater(item) : item,
        ),
      }));
    },
    [updateProgram, yearIndex],
  );

  const uploadSlot = async (slot: number, file: File) => {
    if (!program || !year) return;
    const previousSrc = year.images[slot]?.src ?? "";
    setUploadingSlot(slot);
    setStatus({ type: "idle", message: "" });
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("programSlug", program.slug);
      form.append("year", year.year);
      form.append("slot", String(slot));
      const res = await fetch("/api/upgrade/upload", {
        method: "POST",
        body: form,
      });
      const body = (await res.json()) as {
        src?: string;
        ratio?: number;
        error?: string;
      };
      if (!res.ok || !body.src) {
        setStatus({ type: "error", message: body.error ?? "Upload failed" });
        return;
      }
      updateYear((entry) => {
        const images = [...entry.images];
        images[slot] = { src: body.src!, ratio: body.ratio ?? 16 / 9 };
        return { ...entry, images };
      });
      if (previousSrc) {
        void deleteDraftCloudinaryUrls([previousSrc], savedData);
      }
      setStatus({
        type: "ok",
        message: `Uploaded image ${slot + 1}. Click Save to publish.`,
      });
    } catch {
      setStatus({ type: "error", message: "Upload failed" });
    } finally {
      setUploadingSlot(null);
    }
  };

  return (
    <div className="mt-8 space-y-6">
      <UpgradeToolHeader
        title="Gallery"
        description="Edit program titles, years, the six preview images, and Google Photos album links. Changes go live after Save."
        isDirty={isDirty}
        saving={saving}
        status={status}
        onBack={onBack}
        onHome={onHome}
        onSave={onSave}
        onLogout={onLogout}
      />

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          className="rounded-lg border border-(--ink)/20 bg-white px-3 py-2 text-sm font-medium text-(--ink)"
          onClick={() => {
            setData((prev) => ({
              ...prev,
              programs: [...prev.programs, emptyProgram()],
            }));
            setProgramIndex(data.programs.length);
            setYearIndex(0);
          }}
        >
          Add program
        </button>
        {program && (
          <button
            type="button"
            className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-800"
            onClick={() => {
              if (!confirm(`Delete program “${program.title}”?`)) return;
              const removedUrls = program.years.flatMap((entry) =>
                entry.images.map((image) => image.src),
              );
              setData((prev) => ({
                ...prev,
                programs: prev.programs.filter((_, index) => index !== programIndex),
              }));
              setProgramIndex(0);
              setYearIndex(0);
              void deleteDraftCloudinaryUrls(removedUrls, savedData);
            }}
          >
            Delete program
          </button>
        )}
      </div>

      {data.programs.length === 0 ? (
        <p className="text-(--ink)/70">No programs yet. Add one to get started.</p>
      ) : (
        <>
          <div className="flex flex-wrap gap-2">
            {data.programs.map((item, index) => (
              <button
                key={`${item.slug}-${index}`}
                type="button"
                onClick={() => {
                  setProgramIndex(index);
                  setYearIndex(0);
                }}
                className="rounded-full px-3 py-1.5 text-sm font-medium"
                style={{
                  background:
                    index === programIndex ? "var(--orange)" : "rgba(47,43,40,0.08)",
                  color: index === programIndex ? "#111" : "var(--ink)",
                }}
              >
                {item.title}
              </button>
            ))}
          </div>

          {program && (
            <div className="space-y-6 rounded-2xl bg-white/70 p-5 sm:p-6">
              <label className="block text-sm font-medium text-(--ink)">
                Program title
                <input
                  value={program.title}
                  onChange={(event) => {
                    const title = event.target.value;
                    updateProgram((prog) => ({
                      ...prog,
                      title,
                      slug: slugifyProgramTitle(title) || prog.slug,
                    }));
                  }}
                  className="mt-2 w-full rounded-lg border border-(--ink)/15 bg-white px-3 py-2.5 text-base outline-none focus:border-(--orange)"
                />
              </label>
              <p className="text-xs text-(--ink)/55">URL slug: {program.slug}</p>

              <div className="flex flex-wrap items-end gap-3">
                <div className="block text-sm font-medium text-(--ink)">
                  Year
                  <div
                    className="gallery-controls__years upgrade-year-picker mt-2"
                    data-open={yearPickerOpen ? "true" : undefined}
                    style={{ background: "rgba(42, 42, 42, 0.96)" }}
                  >
                    <div className="gallery-controls__years-list">
                      {(yearPickerOpen
                        ? yearOptions
                        : yearOptions.slice(yearIndex, yearIndex + 1)
                      ).map((entry) => {
                        const realIndex = yearOptions.indexOf(entry);
                        const isActive = realIndex === yearIndex;
                        return (
                          <button
                            key={`${entry.year}-${realIndex}`}
                            type="button"
                            className="gallery-year-pill gallery-controls__year-pill focus-ring-light cursor-pointer"
                            data-active={isActive ? "true" : undefined}
                            aria-pressed={isActive}
                            onClick={() => {
                              setYearIndex(realIndex);
                              setYearPickerOpen(false);
                            }}
                          >
                            {entry.year}
                          </button>
                        );
                      })}
                    </div>
                    {yearOptions.length > 1 && (
                      <button
                        type="button"
                        aria-label={yearPickerOpen ? "Hide other years" : "Show other years"}
                        aria-expanded={yearPickerOpen}
                        className="gallery-controls__years-toggle focus-ring-light"
                        onClick={() => setYearPickerOpen((open) => !open)}
                      >
                        <ChevronDown
                          className={`gallery-controls__years-toggle-icon transition-transform duration-150 ${yearPickerOpen ? "rotate-180" : ""}`}
                        />
                      </button>
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  className="rounded-lg border border-(--ink)/20 bg-white px-3 py-2.5 text-sm font-medium"
                  onClick={() => {
                    if (!program) return;
                    const existing = new Set(program.years.map((entry) => entry.year));
                    const currentYear = String(new Date().getFullYear());
                    const suggestion = existing.has(currentYear) ? "" : currentYear;
                    // A blind "just use the current calendar year" default silently
                    // created a second same-labeled entry once a year already
                    // existed — two identical pills in the picker below, easy to
                    // mix up, and Save destroys Cloudinary assets for anything
                    // that falls out of the submitted data. Always ask instead.
                    const input = window.prompt(
                      "Year label for the new entry (e.g. 2027):",
                      suggestion,
                    );
                    if (input === null) return;
                    const trimmed = input.trim();
                    if (!trimmed) {
                      window.alert("Year label can't be empty.");
                      return;
                    }
                    if (existing.has(trimmed)) {
                      window.alert(
                        `"${trimmed}" already exists for this program. Choose a different label, or select it from the picker to edit it directly.`,
                      );
                      return;
                    }
                    updateProgram((prog) => ({
                      ...prog,
                      years: [emptyYear(trimmed), ...prog.years],
                    }));
                    setYearIndex(0);
                  }}
                >
                  Add year
                </button>
                {year && program.years.length > 1 && (
                  <button
                    type="button"
                    className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm font-medium text-red-800"
                    onClick={() => {
                      if (!confirm(`Delete year ${year.year}?`)) return;
                      const removedUrls = year.images.map((image) => image.src);
                      updateProgram((prog) => ({
                        ...prog,
                        years: prog.years.filter((_, index) => index !== yearIndex),
                      }));
                      setYearIndex(0);
                      void deleteDraftCloudinaryUrls(removedUrls, savedData);
                    }}
                  >
                    Delete year
                  </button>
                )}
              </div>

              {year && (
                <>
                  <label className="block text-sm font-medium text-(--ink)">
                    Year label
                    <input
                      value={year.year}
                      onChange={(event) =>
                        updateYear((entry) => ({
                          ...entry,
                          year: event.target.value,
                        }))
                      }
                      className="mt-2 w-full max-w-xs rounded-lg border border-(--ink)/15 bg-white px-3 py-2.5 outline-none focus:border-(--orange)"
                    />
                  </label>

                  <label className="block text-sm font-medium text-(--ink)">
                    Google Photos album link
                    <input
                      type="url"
                      value={year.albumUrl}
                      placeholder="https://photos.google.com/share/..."
                      onChange={(event) =>
                        updateYear((entry) => ({
                          ...entry,
                          albumUrl: event.target.value,
                        }))
                      }
                      className="mt-2 w-full rounded-lg border border-(--ink)/15 bg-white px-3 py-2.5 outline-none focus:border-(--orange)"
                    />
                  </label>

                  <div>
                    <h2 className="text-sm font-medium text-(--ink)">
                      Preview images (6)
                    </h2>
                    <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                      {year.images.map((image, slot) => (
                        <div
                          key={slot}
                          className="overflow-hidden rounded-xl border border-(--ink)/10 bg-(--cream-light)"
                        >
                          <div className="relative aspect-video bg-(--cream)">
                            {image.src ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={image.src}
                                alt={`${program.title} ${year.year} — ${slot + 1}`}
                                className="absolute inset-0 h-full w-full object-cover"
                              />
                            ) : (
                              <div className="absolute inset-0 flex items-center justify-center text-sm text-(--ink)/45">
                                Empty slot {slot + 1}
                              </div>
                            )}
                          </div>
                          <div className="flex gap-2 p-3">
                            <label className="inline-flex flex-1 cursor-pointer items-center justify-center rounded-lg bg-(--orange) px-3 py-2 text-center text-sm font-semibold text-black">
                              {uploadingSlot === slot ? "Uploading…" : "Upload"}
                              <input
                                type="file"
                                accept="image/*"
                                className="sr-only"
                                disabled={uploadingSlot !== null}
                                onChange={(event) => {
                                  const file = event.target.files?.[0];
                                  event.target.value = "";
                                  if (file) void uploadSlot(slot, file);
                                }}
                              />
                            </label>
                            {image.src && (
                              <button
                                type="button"
                                className="rounded-lg border border-(--ink)/20 px-3 py-2 text-sm"
                                onClick={() => {
                                  const clearedSrc = image.src;
                                  updateYear((entry) => {
                                    const images = [...entry.images];
                                    images[slot] = { src: "", ratio: 16 / 9 };
                                    return { ...entry, images };
                                  });
                                  void deleteDraftCloudinaryUrls([clearedSrc], savedData);
                                }}
                              >
                                Clear
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
