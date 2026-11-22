"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowDown, ArrowUp, Check, ImagePlus, Loader2, Pencil, Plus, Trash2, Upload } from "lucide-react";
import type { Story } from "@/lib/licences/catalogue";
import type { BunnyVideo } from "@/lib/licences/bunny";
import { blankDocumentary, documentaryProblem } from "@/lib/documentaries/normalize";
import { UpgradeToolHeader, type UpgradeStatus } from "@/components/upgrade/upgrade-tool-header";
import { cn } from "@/lib/utils";

/**
 * Staff list of documentaries + a one-question-per-screen wizard to add or
 * edit one. Every change saves straight away.
 */

const INPUT =
  "w-full rounded-xl border border-(--ink)/15 bg-white px-4 py-3 text-base text-(--ink) outline-none focus:border-(--orange)";
const ICON_BTN =
  "inline-flex size-10 cursor-pointer items-center justify-center rounded-lg border border-(--ink)/15 bg-white text-(--ink) transition hover:bg-(--cream-light) disabled:cursor-not-allowed disabled:opacity-30";
const NEXT_BTN =
  "hero-cta-btn inline-flex min-h-12 cursor-pointer items-center justify-center gap-2 px-8 text-base font-semibold text-black disabled:cursor-not-allowed disabled:opacity-40";
const BACK_BTN =
  "inline-flex min-h-12 cursor-pointer items-center justify-center rounded-lg px-4 text-base font-medium text-(--ink)/70 hover:bg-(--ink)/5";

interface Props {
  onBack: () => void;
  onHome: () => void;
  onLogout: () => void;
}

export function UpgradeDocumentariesEditor({ onBack, onHome, onLogout }: Props) {
  const [items, setItems] = useState<Story[] | null>(null);
  const [videos, setVideos] = useState<BunnyVideo[]>([]);
  const [editing, setEditing] = useState<{ doc: Story; isNew: boolean } | null>(null);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<UpgradeStatus>({ type: "idle", message: "" });

  const loadVideos = useCallback(
    () =>
      fetchVideos().then((body) => {
        if (body.videos) setVideos(body.videos);
        else setStatus({ type: "error", message: body.error ?? "Couldn't load your videos." });
      }),
    [],
  );

  useEffect(() => {
    fetch("/api/upgrade/documentaries", { cache: "no-store" })
      .then((res) => res.json() as Promise<{ items?: Story[] }>)
      .then((data) => setItems(data.items ?? []))
      .catch(() => setStatus({ type: "error", message: "Couldn't load documentaries." }));
    void loadVideos();
  }, [loadVideos]);

  async function persist(next: Story[], message: string): Promise<boolean> {
    setSaving(true);
    setStatus({ type: "idle", message: "" });
    try {
      const res = await fetch("/api/upgrade/documentaries", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: next }),
      });
      const body = (await res.json()) as { items?: Story[]; error?: string };
      if (!res.ok || !body.items) {
        setStatus({ type: "error", message: body.error ?? "Couldn't save. Try again." });
        return false;
      }
      setItems(body.items);
      setStatus({ type: "ok", message });
      return true;
    } catch {
      setStatus({ type: "error", message: "Couldn't save. Try again." });
      return false;
    } finally {
      setSaving(false);
    }
  }

  const list = items ?? [];

  function move(index: number, by: -1 | 1) {
    const next = [...list];
    const [it] = next.splice(index, 1);
    next.splice(index + by, 0, it);
    void persist(next, "Order saved.");
  }

  function remove(d: Story) {
    if (!confirm(`Remove "${d.title || "this documentary"}"?`)) return;
    void persist(list.filter((x) => x.id !== d.id), "Removed.");
  }

  function toggle(d: Story) {
    void persist(
      list.map((x) => (x.id === d.id ? { ...x, published: !x.published } : x)),
      d.published ? "Hidden from the website." : "Now on the website.",
    );
  }

  async function finish(doc: Story) {
    const exists = list.some((x) => x.id === doc.id);
    const next = exists ? list.map((x) => (x.id === doc.id ? doc : x)) : [...list, doc];
    const ok = await persist(next, doc.published ? `"${doc.title}" is on the website.` : `"${doc.title}" saved.`);
    if (ok) setEditing(null);
  }

  if (editing) {
    return (
      <Wizard
        initial={editing.doc}
        isNew={editing.isNew}
        videos={videos}
        saving={saving}
        status={status}
        setStatus={setStatus}
        onVideosChanged={loadVideos}
        onCancel={() => {
          setEditing(null);
          setStatus({ type: "idle", message: "" });
        }}
        onFinish={finish}
      />
    );
  }

  return (
    <div className="mt-8 space-y-6">
      <UpgradeToolHeader
        title="Documentaries"
        description="All of these are included in the licence."
        isDirty={false}
        saving={saving}
        status={status}
        onBack={onBack}
        onHome={onHome}
        onSave={() => {}}
        onLogout={onLogout}
        showSave={false}
      />

      {items === null ? (
        <p className="flex items-center gap-2 text-sm text-(--ink)/60">
          <Loader2 className="size-4 animate-spin" aria-hidden /> Loading…
        </p>
      ) : (
        <ul className="space-y-3">
          {list.map((d, i) => (
            <li key={d.id} className="flex flex-wrap items-center gap-3 rounded-2xl bg-white/70 p-3 sm:flex-nowrap sm:gap-4">
              <div className="aspect-3/2 w-24 shrink-0 overflow-hidden rounded-lg bg-(--cream-light) sm:w-28">
                {d.cover && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={d.cover} alt="" className="size-full object-cover" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold text-(--ink)">{d.title || "Untitled"}</p>
                <p className={cn("text-sm", d.published ? "text-emerald-700" : "text-(--ink)/50")}>
                  {d.published ? "On the website" : "Hidden"}
                  {i === 0 && d.published ? " · Featured" : ""}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => toggle(d)}
                  disabled={saving || (!d.published && Boolean(documentaryProblem(d)))}
                  className="inline-flex min-h-10 cursor-pointer items-center rounded-lg border border-(--ink)/15 bg-white px-3 text-sm font-medium text-(--ink) hover:bg-(--cream-light) disabled:opacity-40"
                >
                  {d.published ? "Hide" : "Show"}
                </button>
                <button type="button" className={ICON_BTN} onClick={() => setEditing({ doc: d, isNew: false })} aria-label={`Edit ${d.title}`}>
                  <Pencil className="size-4" aria-hidden />
                </button>
                <button type="button" className={ICON_BTN} onClick={() => move(i, -1)} disabled={saving || i === 0} aria-label="Move up">
                  <ArrowUp className="size-4" aria-hidden />
                </button>
                <button type="button" className={ICON_BTN} onClick={() => move(i, 1)} disabled={saving || i === list.length - 1} aria-label="Move down">
                  <ArrowDown className="size-4" aria-hidden />
                </button>
                <button type="button" className={cn(ICON_BTN, "text-red-700")} onClick={() => remove(d)} disabled={saving} aria-label={`Remove ${d.title}`}>
                  <Trash2 className="size-4" aria-hidden />
                </button>
              </div>
            </li>
          ))}
          <li>
            <button
              type="button"
              onClick={() => {
                setStatus({ type: "idle", message: "" });
                setEditing({ doc: blankDocumentary(), isNew: true });
              }}
              className="flex min-h-16 w-full cursor-pointer items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-(--ink)/20 text-base font-semibold text-(--ink)/75 transition hover:border-(--orange) hover:text-(--ink)"
            >
              <Plus className="size-5" aria-hidden /> Add documentary
            </button>
          </li>
        </ul>
      )}
    </div>
  );
}

async function fetchVideos(): Promise<{ videos?: BunnyVideo[]; error?: string }> {
  const res = await fetch("/api/upgrade/documentaries/videos", { cache: "no-store" }).catch(() => null);
  return ((await res?.json().catch(() => null)) as { videos?: BunnyVideo[]; error?: string } | null) ?? {};
}

// ---------------------------------------------------------------- the wizard

const STEPS = ["title", "cover", "film", "trailer", "about", "publish"] as const;
type Step = (typeof STEPS)[number];

function Wizard({
  initial,
  isNew,
  videos,
  saving,
  status,
  setStatus,
  onVideosChanged,
  onCancel,
  onFinish,
}: {
  initial: Story;
  isNew: boolean;
  videos: BunnyVideo[];
  saving: boolean;
  status: UpgradeStatus;
  setStatus: (s: UpgradeStatus) => void;
  onVideosChanged: () => Promise<void>;
  onCancel: () => void;
  onFinish: (doc: Story) => void;
}) {
  const [doc, setDoc] = useState(initial);
  const [index, setIndex] = useState(0);
  const [dir, setDir] = useState(1);
  const [busy, setBusy] = useState(false);
  const step: Step = STEPS[index];
  const set = (patch: Partial<Story>) => setDoc((d) => ({ ...d, ...patch }));

  const canNext: Record<Step, boolean> = {
    title: doc.title.trim().length > 0,
    cover: Boolean(doc.cover),
    film: Boolean(doc.videoId),
    trailer: true,
    about: doc.summary.trim().length > 0,
    publish: true,
  };

  const go = (to: number) => {
    setDir(to > index ? 1 : -1);
    setIndex(to);
    setStatus({ type: "idle", message: "" });
  };

  return (
    <div className="mx-auto mt-8 max-w-xl">
      <div className="flex items-center justify-between gap-3">
        <button type="button" onClick={onCancel} className="text-sm font-medium text-(--ink)/60 underline underline-offset-2 hover:text-(--ink)">
          Cancel
        </button>
        <p className="text-sm text-(--ink)/50">
          {isNew ? "New documentary" : doc.title || "Edit"} · {index + 1} of {STEPS.length}
        </p>
      </div>
      <div className="mt-3 flex gap-1.5" aria-hidden>
        {STEPS.map((s, i) => (
          <span key={s} className={cn("h-1.5 flex-1 rounded-full", i <= index ? "bg-(--orange)" : "bg-(--ink)/10")} />
        ))}
      </div>

      <div className="relative mt-8 min-h-72 overflow-hidden">
        <AnimatePresence mode="wait" initial={false} custom={dir}>
          <motion.div
            key={step}
            initial={{ opacity: 0, x: dir * 24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: dir * -24 }}
            transition={{ duration: 0.2 }}
          >
            {step === "title" && (
              <Question title="What's the documentary called?">
                <input
                  autoFocus
                  className={INPUT}
                  value={doc.title}
                  onChange={(e) => set({ title: e.target.value })}
                  onKeyDown={(e) => e.key === "Enter" && canNext.title && go(index + 1)}
                />
              </Question>
            )}

            {step === "cover" && (
              <Question title="Add a cover picture" hint="A wide picture works best.">
                <CoverPicker url={doc.cover} busy={busy} setBusy={setBusy} onChange={(cover) => set({ cover })} setStatus={setStatus} />
              </Question>
            )}

            {step === "film" && (
              <Question title="Which video is the film?">
                <VideoChooser
                  value={doc.videoId}
                  videos={videos}
                  uploadTitle={doc.title}
                  busy={busy}
                  setBusy={setBusy}
                  onChange={(videoId) => set({ videoId })}
                  onUploaded={onVideosChanged}
                  setStatus={setStatus}
                />
              </Question>
            )}

            {step === "trailer" && (
              <Question title="Add a trailer?" hint="Anyone can watch the trailer.">
                <VideoChooser
                  value={doc.trailerId}
                  videos={videos.filter((v) => v.id !== doc.videoId)}
                  uploadTitle={`${doc.title} – trailer`}
                  busy={busy}
                  setBusy={setBusy}
                  noneLabel="No trailer"
                  onChange={(trailerId) => set({ trailerId })}
                  onUploaded={onVideosChanged}
                  setStatus={setStatus}
                />
              </Question>
            )}

            {step === "about" && (
              <Question title="Describe it in one line">
                <input
                  autoFocus
                  className={INPUT}
                  value={doc.summary}
                  maxLength={300}
                  onChange={(e) => set({ summary: e.target.value })}
                />
                <label className="mt-5 block text-sm font-medium text-(--ink)/70">
                  More detail <span className="font-normal text-(--ink)/45">(optional)</span>
                  <textarea rows={4} className={cn(INPUT, "mt-1.5")} value={doc.hook} onChange={(e) => set({ hook: e.target.value })} />
                </label>
              </Question>
            )}

            {step === "publish" && (
              <Question title="Show it on the website now?">
                <div className="space-y-2">
                  <Option selected={doc.published} onSelect={() => set({ published: true })} title="Yes, show it" />
                  <Option selected={!doc.published} onSelect={() => set({ published: false })} title="Not yet, keep it hidden" />
                </div>
              </Question>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {status.message && (
        <p className={cn("mt-4 text-sm", status.type === "error" ? "text-red-700" : "text-emerald-800")} role="status">
          {status.message}
        </p>
      )}

      <div className="mt-8 flex items-center justify-between gap-3">
        {index > 0 ? (
          <button type="button" className={BACK_BTN} onClick={() => go(index - 1)} disabled={busy}>
            Back
          </button>
        ) : (
          <span />
        )}
        {step === "publish" ? (
          <button type="button" className={NEXT_BTN} disabled={saving} onClick={() => onFinish(doc)}>
            {saving ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Check className="size-4" aria-hidden />}
            Done
          </button>
        ) : (
          <button type="button" className={NEXT_BTN} disabled={!canNext[step] || busy} onClick={() => go(index + 1)}>
            {step === "trailer" && !doc.trailerId ? "Skip" : "Next"}
          </button>
        )}
      </div>
    </div>
  );
}

function Question({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <div>
      <h2 className="text-2xl font-semibold text-balance text-(--ink)">{title}</h2>
      {hint && <p className="mt-1 text-sm text-(--ink)/55">{hint}</p>}
      <div className="mt-5">{children}</div>
    </div>
  );
}

function Option({ title, sub, selected, onSelect }: { title: string; sub?: string; selected: boolean; onSelect: () => void }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      className={cn(
        "flex w-full cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 text-left transition-colors",
        selected ? "border-(--orange) bg-(--orange)/10" : "border-(--ink)/15 bg-white hover:bg-(--cream-light)",
      )}
    >
      <span
        className={cn(
          "flex size-5 shrink-0 items-center justify-center rounded-full border-2",
          selected ? "border-(--orange) bg-(--orange)" : "border-(--ink)/30",
        )}
        aria-hidden
      >
        {selected && <span className="size-1.5 rounded-full bg-black" />}
      </span>
      <span className="min-w-0 flex-1 truncate text-base font-medium text-(--ink)">{title}</span>
      {sub && <span className="shrink-0 text-sm text-(--ink)/50">{sub}</span>}
    </button>
  );
}

// ---------------------------------------------------------------- cover

function CoverPicker({
  url,
  busy,
  setBusy,
  onChange,
  setStatus,
}: {
  url: string;
  busy: boolean;
  setBusy: (b: boolean) => void;
  onChange: (url: string) => void;
  setStatus: (s: UpgradeStatus) => void;
}) {
  async function upload(file: File) {
    setBusy(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/upgrade/documentaries/cover", { method: "POST", body: form });
      const body = (await res.json()) as { url?: string; error?: string };
      if (body.url) onChange(body.url);
      else setStatus({ type: "error", message: body.error ?? "Upload failed" });
    } catch {
      setStatus({ type: "error", message: "Upload failed" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <label className="group relative block aspect-3/2 w-full cursor-pointer overflow-hidden rounded-2xl border-2 border-dashed border-(--ink)/20 bg-white transition hover:border-(--orange)">
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="" className="size-full object-cover" />
      ) : (
        <span className="flex size-full flex-col items-center justify-center gap-2 text-base font-medium text-(--ink)/60">
          <ImagePlus className="size-8" aria-hidden /> Choose picture
        </span>
      )}
      {url && !busy && (
        <span className="absolute inset-x-0 bottom-0 bg-black/55 py-2 text-center text-sm font-semibold text-white">Change picture</span>
      )}
      {busy && (
        <span className="absolute inset-0 grid place-items-center bg-white/70">
          <Loader2 className="size-7 animate-spin" aria-label="Uploading" />
        </span>
      )}
      <input
        type="file"
        accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
        className="sr-only"
        disabled={busy}
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) void upload(file);
        }}
      />
    </label>
  );
}

// ---------------------------------------------------------------- film / trailer

function duration(seconds: number) {
  return seconds >= 60 ? `${Math.round(seconds / 60)} min` : `${Math.round(seconds)} sec`;
}

function VideoChooser({
  value,
  videos,
  uploadTitle,
  busy,
  setBusy,
  noneLabel,
  onChange,
  onUploaded,
  setStatus,
}: {
  value: string;
  videos: BunnyVideo[];
  uploadTitle: string;
  busy: boolean;
  setBusy: (b: boolean) => void;
  noneLabel?: string;
  onChange: (id: string) => void;
  onUploaded: () => Promise<void>;
  setStatus: (s: UpgradeStatus) => void;
}) {
  const [progress, setProgress] = useState<number | null>(null);

  async function upload(file: File) {
    setBusy(true);
    setProgress(0);
    try {
      const id = await uploadToBunny(file, uploadTitle || file.name, setProgress);
      onChange(id);
      await onUploaded();
      setStatus({ type: "ok", message: "Uploaded. It'll be ready to play in a few minutes." });
    } catch (error) {
      setStatus({ type: "error", message: error instanceof Error ? error.message : "Upload failed" });
    } finally {
      setProgress(null);
      setBusy(false);
    }
  }

  if (progress !== null) {
    return (
      <div className="rounded-2xl bg-white p-5" role="status">
        <p className="text-base font-medium text-(--ink)">Uploading… {progress}%</p>
        <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-(--ink)/10">
          <div className="h-full bg-(--orange) transition-[width]" style={{ width: `${progress}%` }} />
        </div>
        <p className="mt-2 text-sm text-(--ink)/55">Keep this page open.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <label className="flex min-h-14 w-full cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-dashed border-(--ink)/20 bg-white text-base font-semibold text-(--ink)/80 transition hover:border-(--orange)">
        <Upload className="size-5" aria-hidden /> Upload a video
        <input
          type="file"
          accept="video/*"
          className="sr-only"
          disabled={busy}
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (file) void upload(file);
          }}
        />
      </label>
      {videos.length > 0 && <p className="pt-3 text-sm font-medium text-(--ink)/55">Or pick one already uploaded</p>}
      <div className="max-h-80 space-y-2 overflow-y-auto" role="radiogroup">
        {noneLabel && <Option title={noneLabel} selected={!value} onSelect={() => onChange("")} />}
        {videos.map((v) => (
          <Option
            key={v.id}
            title={v.title}
            sub={v.state === "ready" ? duration(v.length) : v.state === "failed" ? "Failed" : "Processing"}
            selected={value === v.id}
            onSelect={() => onChange(v.id)}
          />
        ))}
      </div>
    </div>
  );
}

/** Sends the file straight from the browser to Bunny over TUS, in chunks. */
async function uploadToBunny(file: File, title: string, onProgress: (pct: number) => void): Promise<string> {
  const start = await fetch("/api/upgrade/documentaries/videos", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title }),
  });
  const creds = (await start.json()) as {
    videoId?: string;
    libraryId?: string;
    expires?: number;
    signature?: string;
    endpoint?: string;
    error?: string;
  };
  if (!start.ok || !creds.videoId || !creds.endpoint) throw new Error(creds.error ?? "Couldn't start the upload");

  const b64 = (s: string) => btoa(unescape(encodeURIComponent(s)));
  const auth = {
    AuthorizationSignature: creds.signature!,
    AuthorizationExpire: String(creds.expires),
    VideoId: creds.videoId,
    LibraryId: String(creds.libraryId),
    "Tus-Resumable": "1.0.0",
  };
  const create = await fetch(creds.endpoint, {
    method: "POST",
    headers: {
      ...auth,
      "Upload-Length": String(file.size),
      "Upload-Metadata": `filetype ${b64(file.type || "video/mp4")},title ${b64(title)}`,
    },
  });
  const location = create.headers.get("Location");
  if (!create.ok || !location) throw new Error("Bunny refused the upload");
  const url = new URL(location, creds.endpoint).toString();

  const CHUNK = 16 * 1024 * 1024;
  let offset = 0;
  while (offset < file.size) {
    let res: Response | null = null;
    for (let attempt = 0; attempt < 3 && !res?.ok; attempt++) {
      res = await fetch(url, {
        method: "PATCH",
        headers: { ...auth, "Upload-Offset": String(offset), "Content-Type": "application/offset+octet-stream" },
        body: file.slice(offset, offset + CHUNK),
      }).catch(() => null);
    }
    if (!res?.ok) throw new Error("Upload stopped. Check your connection and try again.");
    offset = Number(res.headers.get("Upload-Offset") ?? offset + CHUNK);
    onProgress(Math.min(100, Math.round((offset / file.size) * 100)));
  }
  return creds.videoId;
}
