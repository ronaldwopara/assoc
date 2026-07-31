"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown } from "lucide-react";
import {
  PREVIEW_SLOT_COUNT,
  type GalleryCmsData,
  type GalleryCmsProgram,
  type GalleryCmsYearEntry,
} from "@/lib/gallery-cms/types";
import { slugifyProgramTitle } from "@/lib/gallery-cms/slug";

type Status = { type: "idle" | "ok" | "error"; message: string };

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

export function UpgradePageContent({ initialData }: { initialData: GalleryCmsData }) {
  const router = useRouter();
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [password, setPassword] = useState("");
  const [data, setData] = useState<GalleryCmsData>(initialData);
  const [savedData, setSavedData] = useState<GalleryCmsData>(initialData);
  const [programIndex, setProgramIndex] = useState(0);
  const [yearIndex, setYearIndex] = useState(0);
  const [yearPickerOpen, setYearPickerOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploadingSlot, setUploadingSlot] = useState<number | null>(null);
  const [status, setStatus] = useState<Status>({ type: "idle", message: "" });

  useEffect(() => {
    let cancelled = false;
    fetch("/api/upgrade/session")
      .then((res) => {
        if (!cancelled) setAuthed(res.ok);
      })
      .catch(() => {
        if (!cancelled) setAuthed(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const program = data.programs[programIndex] ?? null;
  const year = program?.years[yearIndex] ?? null;

  useEffect(() => {
    setYearPickerOpen(false);
  }, [program?.slug]);

  useEffect(() => {
    if (!program) return;
    if (yearIndex >= program.years.length) setYearIndex(0);
  }, [program, yearIndex]);

  const yearOptions = useMemo(() => program?.years ?? [], [program]);
  const isDirty = useMemo(
    () => JSON.stringify(data) !== JSON.stringify(savedData),
    [data, savedData],
  );

  useEffect(() => {
    if (!isDirty) return;
    const handler = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isDirty]);

  const login = async (event: React.FormEvent) => {
    event.preventDefault();
    setStatus({ type: "idle", message: "" });
    const res = await fetch("/api/upgrade/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    const body = (await res.json()) as { error?: string };
    if (!res.ok) {
      setStatus({ type: "error", message: body.error ?? "Login failed" });
      return;
    }
    setPassword("");
    setAuthed(true);
    const contentRes = await fetch("/api/upgrade/content");
    if (contentRes.ok) {
      const fresh = (await contentRes.json()) as GalleryCmsData;
      setData(fresh);
      setSavedData(fresh);
    }
  };

  const logout = async () => {
    await fetch("/api/upgrade/logout", { method: "POST" });
    setAuthed(false);
  };

  const updateProgram = useCallback(
    (updater: (program: GalleryCmsProgram) => GalleryCmsProgram) => {
      setData((prev) => {
        const programs = prev.programs.map((item, index) =>
          index === programIndex ? updater(item) : item,
        );
        return { ...prev, programs };
      });
    },
    [programIndex],
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

  const save = async () => {
    setSaving(true);
    setStatus({ type: "idle", message: "" });
    try {
      const res = await fetch("/api/upgrade/content", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const body = (await res.json()) as GalleryCmsData & { error?: string };
      if (!res.ok) {
        setStatus({ type: "error", message: body.error ?? "Save failed" });
        return;
      }
      setData(body);
      setSavedData(body);
      setStatus({
        type: "ok",
        message: "Saved. The public gallery will use this content now.",
      });
      router.refresh();
    } catch {
      setStatus({ type: "error", message: "Save failed" });
    } finally {
      setSaving(false);
    }
  };

  const uploadSlot = async (slot: number, file: File) => {
    if (!program || !year) return;
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

  if (authed === null) {
    return (
      <p className="mx-auto max-w-md px-5 py-16 text-center text-(--ink)/70">
        Checking access…
      </p>
    );
  }

  if (!authed) {
    return (
      <form
        onSubmit={login}
        className="mx-auto max-w-md rounded-2xl bg-white/70 px-6 py-8 shadow-sm"
        style={{ marginTop: "max(2.5rem, calc(1.25rem + var(--safe-top)))" }}
      >
        <h1 className="text-2xl font-semibold text-(--ink)">Gallery upgrade</h1>
        <p className="mt-2 text-sm text-(--ink)/70">
          Enter the site password to manage gallery previews and album links.
        </p>
        <label className="mt-6 block text-sm font-medium text-(--ink)">
          Password
          <input
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="mt-2 w-full rounded-lg border border-(--ink)/15 bg-white px-3 py-2.5 text-base text-(--ink) outline-none focus:border-(--orange)"
          />
        </label>
        {status.type === "error" && (
          <p className="mt-3 text-sm text-red-700" role="alert">
            {status.message}
          </p>
        )}
        <button
          type="submit"
          className="hero-cta-btn mt-6 inline-flex min-h-11 w-full cursor-pointer items-center justify-center px-6 text-sm font-semibold text-black"
        >
          Continue
        </button>
      </form>
    );
  }

  return (
    <div
      className="mx-auto max-w-4xl px-5 pb-8 sm:px-6 sm:pb-10"
      style={{ paddingTop: "max(2rem, calc(1.25rem + var(--safe-top)))" }}
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold text-(--ink)">Gallery upgrade</h1>
          <p className="mt-2 max-w-xl text-sm text-(--ink)/70">
            Edit program titles, years, the six preview images, and Google Photos
            album links. Changes go live after Save.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {isDirty && !saving && (
            <span className="text-sm font-medium text-amber-700" role="status">
              Unsaved changes
            </span>
          )}
          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="hero-cta-btn inline-flex min-h-11 cursor-pointer items-center justify-center px-6 text-sm font-semibold text-black disabled:opacity-60"
          >
            {saving ? "Saving…" : "Save"}
          </button>
          <button
            type="button"
            onClick={logout}
            className="inline-flex min-h-11 cursor-pointer items-center justify-center rounded-lg border border-(--ink)/20 px-4 text-sm font-medium text-(--ink)"
          >
            Log out
          </button>
        </div>
      </div>

      {status.message && (
        <p
          className={`mt-4 text-sm ${status.type === "error" ? "text-red-700" : "text-emerald-800"}`}
          role="status"
        >
          {status.message}
        </p>
      )}

      <div className="mt-8 flex flex-wrap gap-3">
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
              setData((prev) => ({
                ...prev,
                programs: prev.programs.filter((_, index) => index !== programIndex),
              }));
              setProgramIndex(0);
              setYearIndex(0);
            }}
          >
            Delete program
          </button>
        )}
      </div>

      {data.programs.length === 0 ? (
        <p className="mt-10 text-(--ink)/70">No programs yet. Add one to get started.</p>
      ) : (
        <>
          <div className="mt-6 flex flex-wrap gap-2">
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
            <div className="mt-8 space-y-6 rounded-2xl bg-white/70 p-5 sm:p-6">
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
                    style={{ background: "rgba(42, 42, 42, 0.96)" }}
                  >
                    <div className="gallery-controls__years-list">
                      {(yearPickerOpen ? yearOptions : yearOptions.slice(yearIndex, yearIndex + 1)).map(
                        (entry) => {
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
                        },
                      )}
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
                    const nextYear = String(new Date().getFullYear());
                    updateProgram((prog) => ({
                      ...prog,
                      years: [emptyYear(nextYear), ...prog.years],
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
                      updateProgram((prog) => ({
                        ...prog,
                        years: prog.years.filter((_, index) => index !== yearIndex),
                      }));
                      setYearIndex(0);
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
                                onClick={() =>
                                  updateYear((entry) => {
                                    const images = [...entry.images];
                                    images[slot] = { src: "", ratio: 16 / 9 };
                                    return { ...entry, images };
                                  })
                                }
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
