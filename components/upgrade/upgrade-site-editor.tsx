"use client";

import { useEffect, useState, type ReactNode } from "react";
import {
  ArrowDown,
  ArrowUp,
  CalendarDays,
  ChevronRight,
  Film,
  HandHeart,
  Handshake,
  ImagePlus,
  Info,
  LayoutTemplate,
  Loader2,
  Megaphone,
  Pencil,
  Phone,
  Plus,
  Trash2,
  Upload,
  Users,
  X,
} from "lucide-react";
import type { ActionId, SiteContent } from "@/lib/site-content/types";
import { UpgradeToolHeader, type UpgradeStatus } from "@/components/upgrade/upgrade-tool-header";
import { StepWizard, WizardChoices, WizardOption, WIZARD_INPUT, type WizardStep } from "@/components/ui/step-wizard";
import { cn } from "@/lib/utils";

/**
 * Upgrade → Site sections. Every section is a short list of parts; a part is
 * either a step-by-step edit of a few things, or a list you add to, edit,
 * reorder and remove from. Everything saves when a step-by-step edit is done.
 */

// ---------------------------------------------------------------- field specs

type Obj = Record<string, unknown>;

type Field = {
  key: string;
  title: string;
  hint?: string;
  type: "text" | "longtext" | "image" | "video" | "url" | "lines" | "choice";
  optional?: boolean;
  choices?: { value: string; label: string }[];
  /** Only ask when this is true for the draft. */
  when?: (draft: Obj) => boolean;
};

const ICON_BTN =
  "inline-flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-lg border border-(--ink)/15 bg-white text-(--ink) transition hover:bg-(--cream-light) disabled:cursor-not-allowed disabled:opacity-30";

const isVideoUrl = (u: string) => /\/video\/upload\/|\.(mp4|webm|mov)(\?|$)/i.test(u);

// ---------------------------------------------------------------- uploads

async function uploadImage(file: File): Promise<string> {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch("/api/upgrade/site/image", { method: "POST", body: form });
  const body = (await res.json()) as { url?: string; error?: string };
  if (!body.url) throw new Error(body.error ?? "Upload failed");
  return body.url;
}

/** Straight from the browser to Cloudinary, in 20 MB pieces. */
async function uploadVideo(file: File, onProgress: (pct: number) => void): Promise<string> {
  const signRes = await fetch("/api/upgrade/site/video-sign", { method: "POST" });
  const sign = (await signRes.json()) as { url?: string; apiKey?: string; timestamp?: number; folder?: string; signature?: string; error?: string };
  if (!sign.url) throw new Error(sign.error ?? "Couldn't start the upload");
  const CHUNK = 20 * 1024 * 1024;
  const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  let result: { secure_url?: string; error?: { message?: string } } = {};
  for (let start = 0; start < file.size; start += CHUNK) {
    const end = Math.min(start + CHUNK, file.size);
    const form = new FormData();
    form.append("file", file.slice(start, end), file.name);
    form.append("api_key", sign.apiKey!);
    form.append("timestamp", String(sign.timestamp));
    form.append("folder", sign.folder!);
    form.append("signature", sign.signature!);
    const res = await fetch(sign.url, {
      method: "POST",
      headers: { "X-Unique-Upload-Id": id, "Content-Range": `bytes ${start}-${end - 1}/${file.size}` },
      body: form,
    });
    result = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(result.error?.message ?? "Upload failed");
    onProgress(Math.round((end / file.size) * 100));
  }
  if (!result.secure_url) throw new Error("Upload failed");
  return result.secure_url;
}

// ---------------------------------------------------------------- one field

function FieldInput({
  field,
  value,
  onChange,
  setBusy,
  onError,
}: {
  field: Field;
  value: unknown;
  onChange: (v: unknown) => void;
  setBusy: (b: boolean) => void;
  onError: (m: string) => void;
}) {
  const [progress, setProgress] = useState<number | null>(null);
  const str = typeof value === "string" ? value : "";

  if (field.type === "text" || field.type === "url") {
    return (
      <input
        autoFocus
        inputMode={field.type === "url" ? "url" : undefined}
        className={WIZARD_INPUT}
        value={str}
        placeholder={field.type === "url" ? "https://…" : undefined}
        onChange={(e) => onChange(e.target.value)}
      />
    );
  }
  if (field.type === "longtext") {
    return <textarea autoFocus rows={6} className={WIZARD_INPUT} value={str} onChange={(e) => onChange(e.target.value)} />;
  }
  if (field.type === "choice") {
    return (
      <WizardChoices>
        {field.choices!.map((c) => (
          <WizardOption key={c.value} title={c.label} selected={str === c.value} onSelect={() => onChange(c.value)} />
        ))}
      </WizardChoices>
    );
  }
  if (field.type === "lines") {
    const lines = Array.isArray(value) ? (value as string[]) : [];
    return (
      <div className="space-y-2">
        {lines.map((line, i) => (
          <div key={i} className="flex items-start gap-2">
            <textarea
              rows={2}
              className={WIZARD_INPUT}
              value={line}
              onChange={(e) => onChange(lines.map((l, j) => (j === i ? e.target.value : l)))}
            />
            <button type="button" className={cn(ICON_BTN, "mt-2 text-red-700")} aria-label="Remove" onClick={() => onChange(lines.filter((_, j) => j !== i))}>
              <X className="size-4" aria-hidden />
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={() => onChange([...lines, ""])}
          className="inline-flex min-h-11 cursor-pointer items-center gap-1.5 rounded-lg border-2 border-dashed border-(--ink)/20 px-4 text-sm font-semibold text-(--ink)/75 hover:border-(--orange)"
        >
          <Plus className="size-4" aria-hidden /> Add a line
        </button>
      </div>
    );
  }

  // image / video
  const video = field.type === "video";
  async function pick(file: File) {
    setBusy(true);
    setProgress(0);
    try {
      onChange(video ? await uploadVideo(file, setProgress) : await uploadImage(file));
    } catch (e) {
      onError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setBusy(false);
      setProgress(null);
    }
  }
  return (
    <label className="group relative block aspect-video w-full cursor-pointer overflow-hidden rounded-2xl border-2 border-dashed border-(--ink)/20 bg-white transition hover:border-(--orange)">
      {str ? (
        video || isVideoUrl(str) ? (
          <video src={str} muted autoPlay loop playsInline className="size-full object-cover" />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={str} alt="" className="size-full object-contain" />
        )
      ) : (
        <span className="flex size-full flex-col items-center justify-center gap-2 text-base font-medium text-(--ink)/60">
          {video ? <Upload className="size-8" aria-hidden /> : <ImagePlus className="size-8" aria-hidden />}
          {video ? "Choose video" : "Choose picture"}
        </span>
      )}
      {str && progress === null && (
        <span className="absolute inset-x-0 bottom-0 bg-black/55 py-2 text-center text-sm font-semibold text-white">
          {video ? "Change video" : "Change picture"}
        </span>
      )}
      {progress !== null && (
        <span className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-white/80 text-sm font-medium text-(--ink)">
          <Loader2 className="size-7 animate-spin" aria-hidden />
          {video ? `Uploading… ${progress}% — keep this page open` : "Uploading…"}
        </span>
      )}
      <input
        type="file"
        accept={video ? "video/*" : "image/jpeg,image/png,image/webp,image/heic,image/heif"}
        className="sr-only"
        disabled={progress !== null}
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (f) void pick(f);
        }}
      />
    </label>
  );
}

function filled(field: Field, v: unknown): boolean {
  if (Array.isArray(v)) return v.some((x) => String(x).trim());
  return typeof v === "string" && v.trim().length > 0;
}

// ---------------------------------------------------------------- a step-by-step edit

type WizardCfg = {
  label: string;
  fields: Field[];
  initial: Obj;
  onDone: (draft: Obj) => Promise<boolean>;
};

function ObjectWizard({ cfg, saving, onCancel }: { cfg: WizardCfg; saving: boolean; onCancel: () => void }) {
  const [draft, setDraft] = useState<Obj>(cfg.initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const steps: WizardStep[] = cfg.fields
    .filter((f) => !f.when || f.when(draft))
    .map((f) => ({
      key: f.key,
      title: f.title,
      hint: f.hint ?? (f.optional ? "Optional." : undefined),
      ready: f.optional || f.type === "choice" || filled(f, draft[f.key]),
      skippable: f.optional && !filled(f, draft[f.key]),
      content: (
        <FieldInput
          field={f}
          value={draft[f.key]}
          onChange={(v) => {
            setError("");
            setDraft((d) => ({ ...d, [f.key]: v }));
          }}
          setBusy={setBusy}
          onError={setError}
        />
      ),
    }));

  async function finish() {
    const clean: Obj = { ...draft };
    for (const f of cfg.fields) {
      if (f.type === "lines" && Array.isArray(clean[f.key])) clean[f.key] = (clean[f.key] as string[]).map((l) => l.trim()).filter(Boolean);
    }
    await cfg.onDone(clean);
  }

  return (
    <div className="mt-8">
      <StepWizard
        steps={steps}
        label={cfg.label}
        busy={busy}
        onCancel={onCancel}
        onFinish={finish}
        finishLabel="Save"
        finishing={saving}
        status={error ? { type: "error", message: error } : undefined}
      />
    </div>
  );
}

// ---------------------------------------------------------------- building blocks of a section screen

function Part({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <section className="rounded-2xl bg-white/70 p-4 sm:p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-(--ink)">{title}</h2>
        {action}
      </div>
      {children && <div className="mt-3">{children}</div>}
    </section>
  );
}

function EditButton({ onClick, label = "Edit" }: { onClick: () => void; label?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex min-h-10 cursor-pointer items-center gap-1.5 rounded-lg border border-(--ink)/15 bg-white px-3 text-sm font-semibold text-(--ink) hover:bg-(--cream-light)"
    >
      <Pencil className="size-4" aria-hidden /> {label}
    </button>
  );
}

function Thumb({ src }: { src?: string }) {
  if (!src) return null;
  return isVideoUrl(src) ? (
    <video src={src} muted playsInline className="size-12 shrink-0 rounded-md object-cover" />
  ) : (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt="" className="size-12 shrink-0 rounded-md bg-(--cream-light) object-contain" />
  );
}

function ListRows<T>({
  items,
  row,
  onEdit,
  onMove,
  onRemove,
  onAdd,
  addLabel,
  saving,
  minItems = 0,
}: {
  items: T[];
  row: (item: T) => { title: string; sub?: string; thumb?: string };
  onEdit?: (index: number) => void;
  onMove: (from: number, to: number) => void;
  onRemove: (index: number) => void;
  onAdd: () => void;
  addLabel: string;
  saving: boolean;
  minItems?: number;
}) {
  return (
    <div className="space-y-2">
      {items.map((item, i) => {
        const r = row(item);
        return (
          <div key={i} className="flex items-center gap-3 rounded-xl bg-white px-3 py-2.5">
            <Thumb src={r.thumb} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-(--ink)">{r.title || "Untitled"}</p>
              {r.sub && <p className="truncate text-xs text-(--ink)/55">{r.sub}</p>}
            </div>
            {onEdit && (
              <button type="button" className={ICON_BTN} aria-label="Edit" onClick={() => onEdit(i)}>
                <Pencil className="size-4" aria-hidden />
              </button>
            )}
            <button type="button" className={ICON_BTN} aria-label="Move up" disabled={saving || i === 0} onClick={() => onMove(i, i - 1)}>
              <ArrowUp className="size-4" aria-hidden />
            </button>
            <button type="button" className={ICON_BTN} aria-label="Move down" disabled={saving || i === items.length - 1} onClick={() => onMove(i, i + 1)}>
              <ArrowDown className="size-4" aria-hidden />
            </button>
            <button
              type="button"
              className={cn(ICON_BTN, "text-red-700")}
              aria-label="Remove"
              disabled={saving || items.length <= minItems}
              onClick={() => {
                if (confirm(`Remove "${r.title || "this"}"?`)) onRemove(i);
              }}
            >
              <Trash2 className="size-4" aria-hidden />
            </button>
          </div>
        );
      })}
      <button
        type="button"
        onClick={onAdd}
        disabled={saving}
        className="flex min-h-12 w-full cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-dashed border-(--ink)/20 text-sm font-semibold text-(--ink)/75 transition hover:border-(--orange) hover:text-(--ink)"
      >
        <Plus className="size-4" aria-hidden /> {addLabel}
      </button>
    </div>
  );
}

function move<T>(list: T[], from: number, to: number): T[] {
  if (to < 0 || to >= list.length) return list;
  const next = [...list];
  const [it] = next.splice(from, 1);
  next.splice(to, 0, it);
  return next;
}

// ---------------------------------------------------------------- the sections

type SectionId = "hero" | "about" | "programs" | "actions" | "events" | "updates" | "sponsors" | "board" | "contact";

const SECTIONS: { id: SectionId; title: string; sub: string; icon: typeof Info }[] = [
  { id: "hero", title: "Top of the homepage", sub: "Big heading, buttons, slideshow", icon: LayoutTemplate },
  { id: "about", title: "About Us", sub: "Mission, vision, values", icon: Info },
  { id: "programs", title: "Programs", sub: "The six program tiles", icon: Film },
  { id: "actions", title: "Get involved cards", sub: "Membership, donate, volunteer…", icon: HandHeart },
  { id: "events", title: "Events", sub: "Upcoming events and tickets", icon: CalendarDays },
  { id: "updates", title: "Updates", sub: "News cards and photo strip", icon: Megaphone },
  { id: "sponsors", title: "Sponsors", sub: "Thank-you text and logos", icon: Handshake },
  { id: "board", title: "Board", sub: "Meet the Board, on About Us", icon: Users },
  { id: "contact", title: "Contact details", sub: "Email, phone, social links", icon: Phone },
];

const ACTION_NAMES: Record<ActionId, string> = {
  membership: "Membership",
  donate: "Donate",
  events: "Events",
  volunteer: "Volunteer",
  vendor: "Vendor",
  contact: "Contact",
};
const ACTION_ORDER: ActionId[] = ["membership", "donate", "events", "volunteer", "vendor", "contact"];

const PICTURE: Field = { key: "v", type: "image", title: "Choose the picture" };

interface Props {
  onBack: () => void;
  onHome: () => void;
  onLogout: () => void;
}

export function UpgradeSiteEditor({ onBack, onHome, onLogout }: Props) {
  const [content, setContent] = useState<SiteContent | null>(null);
  const [section, setSection] = useState<SectionId | null>(null);
  const [program, setProgram] = useState<number | null>(null);
  const [wizard, setWizard] = useState<WizardCfg | null>(null);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<UpgradeStatus>({ type: "idle", message: "" });

  useEffect(() => {
    fetch("/api/upgrade/site", { cache: "no-store" })
      .then((r) => r.json() as Promise<SiteContent>)
      .then(setContent)
      .catch(() => setStatus({ type: "error", message: "Couldn't load the site content." }));
  }, []);

  async function save(next: SiteContent): Promise<boolean> {
    setSaving(true);
    setStatus({ type: "idle", message: "" });
    try {
      const res = await fetch("/api/upgrade/site", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(next),
      });
      const body = (await res.json()) as SiteContent & { error?: string };
      if (!res.ok || body.error) {
        setStatus({ type: "error", message: body.error ?? "Couldn't save. Try again." });
        return false;
      }
      setContent(body);
      setStatus({ type: "ok", message: "Saved. It's live now." });
      return true;
    } catch {
      setStatus({ type: "error", message: "Couldn't save. Try again." });
      return false;
    } finally {
      setSaving(false);
    }
  }

  /** Opens a step-by-step edit; Done saves `apply(draft)` and comes back. */
  function edit(label: string, fields: Field[], initial: Obj, apply: (draft: Obj) => SiteContent) {
    setStatus({ type: "idle", message: "" });
    setWizard({
      label,
      fields,
      initial,
      onDone: async (draft) => {
        const ok = await save(apply(draft));
        if (ok) setWizard(null);
        return ok;
      },
    });
  }

  const header = (title: string, description: string, back: () => void, backLabel?: string) => (
    <UpgradeToolHeader
      backLabel={backLabel}
      title={title}
      description={description}
      isDirty={false}
      saving={saving}
      status={status}
      onBack={back}
      onHome={onHome}
      onSave={() => {}}
      onLogout={onLogout}
      showSave={false}
    />
  );

  if (wizard) return <ObjectWizard key={wizard.label} cfg={wizard} saving={saving} onCancel={() => setWizard(null)} />;

  if (!content) {
    return (
      <div className="mt-8 space-y-6">
        {header("Site sections", "Change the words and pictures on the website.", onBack)}
        <p className="flex items-center gap-2 text-sm text-(--ink)/60">
          <Loader2 className="size-4 animate-spin" aria-hidden /> Loading…
        </p>
      </div>
    );
  }

  const c = content;
  const set = (patch: Partial<SiteContent>) => ({ ...c, ...patch });
  const goSections = () => {
    setSection(null);
    setProgram(null);
    setStatus({ type: "idle", message: "" });
  };

  // ------------------------------------------------ menu
  if (!section) {
    return (
      <div className="mt-8 space-y-6">
        {header("Site sections", "Change the words and pictures on the website.", onBack)}
        <ul className="grid gap-3 sm:grid-cols-2">
          {SECTIONS.map((s) => (
            <li key={s.id}>
              <button
                type="button"
                onClick={() => {
                  setStatus({ type: "idle", message: "" });
                  setSection(s.id);
                }}
                className="flex w-full cursor-pointer items-center gap-4 rounded-2xl bg-white/70 p-4 text-left transition hover:bg-white"
              >
                <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-(--orange)/15 text-(--ink)">
                  <s.icon className="size-5" aria-hidden />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold text-(--ink)">{s.title}</span>
                  <span className="block truncate text-sm text-(--ink)/55">{s.sub}</span>
                </span>
                <ChevronRight className="size-5 text-(--ink)/40" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  const meta = SECTIONS.find((s) => s.id === section)!;
  let body: ReactNode = null;

  // ------------------------------------------------ hero
  if (section === "hero") {
    const h = c.hero;
    body = (
      <>
        <Part
          title="Words and buttons"
          action={
            <EditButton
              onClick={() =>
                edit(
                  "Top of the homepage",
                  [
                    { key: "headline", type: "text", title: "Big heading" },
                    { key: "subheadline", type: "longtext", title: "Line under the heading" },
                    { key: "primaryButton", type: "text", title: "Words on the main button", hint: "It opens the Join form." },
                    { key: "secondaryButton", type: "text", title: "Words on the second button", hint: "It scrolls to Programs." },
                  ],
                  { ...h },
                  (d) => set({ hero: { ...h, ...(d as Partial<typeof h>) } }),
                )
              }
            />
          }
        >
          <p className="font-semibold text-(--ink)">{h.headline}</p>
          <p className="mt-1 text-sm text-(--ink)/65">{h.subheadline}</p>
        </Part>
        <Part title="Slideshow photos">
          <ListRows
            items={h.slides}
            row={(s) => ({ title: s.alt || "Photo", thumb: s.src })}
            saving={saving}
            minItems={1}
            onEdit={(i) =>
              edit(
                "Slideshow photo",
                [
                  { key: "src", type: "image", title: "Choose the photo" },
                  { key: "alt", type: "text", title: "Describe the photo", hint: "For people using screen readers." },
                ],
                { ...h.slides[i] },
                (d) => set({ hero: { ...h, slides: h.slides.map((s, j) => (j === i ? { src: String(d.src), alt: String(d.alt) } : s)) } }),
              )
            }
            onMove={(a, b) => void save(set({ hero: { ...h, slides: move(h.slides, a, b) } }))}
            onRemove={(i) => void save(set({ hero: { ...h, slides: h.slides.filter((_, j) => j !== i) } }))}
            addLabel="Add a photo"
            onAdd={() =>
              edit(
                "New photo",
                [
                  { key: "src", type: "image", title: "Choose the photo" },
                  { key: "alt", type: "text", title: "Describe the photo", hint: "For people using screen readers." },
                ],
                { src: "", alt: "" },
                (d) => set({ hero: { ...h, slides: [...h.slides, { src: String(d.src), alt: String(d.alt) }] } }),
              )
            }
          />
        </Part>
      </>
    );
  }

  // ------------------------------------------------ about
  if (section === "about") {
    const a = c.about;
    const lineFields: Field[] = [{ key: "v", type: "longtext", title: "Write it" }];
    body = (
      <>
        <Part title="Our Mission">
          <ListRows
            items={a.mission}
            row={(m) => ({ title: m })}
            saving={saving}
            onEdit={(i) => edit("Mission", lineFields, { v: a.mission[i] }, (d) => set({ about: { ...a, mission: a.mission.map((m, j) => (j === i ? String(d.v) : m)) } }))}
            onMove={(x, y) => void save(set({ about: { ...a, mission: move(a.mission, x, y) } }))}
            onRemove={(i) => void save(set({ about: { ...a, mission: a.mission.filter((_, j) => j !== i) } }))}
            addLabel="Add a mission point"
            onAdd={() => edit("New mission point", lineFields, { v: "" }, (d) => set({ about: { ...a, mission: [...a.mission, String(d.v)] } }))}
          />
        </Part>
        <Part
          title="Our Vision"
          action={
            <EditButton
              onClick={() => edit("Vision", [{ key: "v", type: "longtext", title: "Our Vision" }], { v: a.vision }, (d) => set({ about: { ...a, vision: String(d.v) } }))}
            />
          }
        >
          <p className="text-sm text-(--ink)/70">{a.vision}</p>
        </Part>
        <Part title="Our Values">
          <ListRows
            items={a.values}
            row={(v) => ({ title: v.title, sub: v.text })}
            saving={saving}
            onEdit={(i) =>
              edit(
                "Value",
                [
                  { key: "title", type: "text", title: "Name of the value", hint: "For example “Cultural Pride”." },
                  { key: "text", type: "longtext", title: "What it means" },
                ],
                { ...a.values[i] },
                (d) => set({ about: { ...a, values: a.values.map((v, j) => (j === i ? { title: String(d.title), text: String(d.text) } : v)) } }),
              )
            }
            onMove={(x, y) => void save(set({ about: { ...a, values: move(a.values, x, y) } }))}
            onRemove={(i) => void save(set({ about: { ...a, values: a.values.filter((_, j) => j !== i) } }))}
            addLabel="Add a value"
            onAdd={() =>
              edit(
                "New value",
                [
                  { key: "title", type: "text", title: "Name of the value" },
                  { key: "text", type: "longtext", title: "What it means" },
                ],
                { title: "", text: "" },
                (d) => set({ about: { ...a, values: [...a.values, { title: String(d.title), text: String(d.text) }] } }),
              )
            }
          />
        </Part>
        <Part
          title="Pictures"
          action={
            <EditButton
              onClick={() =>
                edit(
                  "About Us pictures",
                  [
                    { key: "0", type: "image", title: "Picture beside Our Mission" },
                    { key: "1", type: "image", title: "Picture beside Our Vision" },
                    { key: "2", type: "image", title: "Picture beside Our Values" },
                  ],
                  { 0: a.images[0] ?? "", 1: a.images[1] ?? "", 2: a.images[2] ?? "" },
                  (d) => set({ about: { ...a, images: [String(d[0]), String(d[1]), String(d[2])] } }),
                )
              }
            />
          }
        >
          <div className="flex gap-2">
            {a.images.map((src, i) => (
              <Thumb key={i} src={src} />
            ))}
          </div>
        </Part>
      </>
    );
  }

  // ------------------------------------------------ programs
  if (section === "programs" && program === null) {
    const p = c.programs;
    body = (
      <>
        <Part
          title="Heading"
          action={
            <EditButton
              onClick={() =>
                edit(
                  "Programs heading",
                  [
                    { key: "title", type: "text", title: "Section heading" },
                    { key: "intro", type: "longtext", title: "Line under it" },
                  ],
                  { title: p.title, intro: p.intro },
                  (d) => set({ programs: { ...p, title: String(d.title), intro: String(d.intro) } }),
                )
              }
            />
          }
        >
          <p className="font-semibold text-(--ink)">{p.title}</p>
          <p className="mt-1 text-sm text-(--ink)/65">{p.intro}</p>
        </Part>
        <Part title="The six programs">
          <div className="space-y-2">
            {p.items.map((it, i) => (
              <button
                key={it.area}
                type="button"
                onClick={() => setProgram(i)}
                className="flex w-full cursor-pointer items-center gap-3 rounded-xl bg-white px-3 py-2.5 text-left hover:bg-(--cream-light)"
              >
                <Thumb src={it.video} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-(--ink)">{it.title}</span>
                  <span className="block truncate text-xs text-(--ink)/55">{it.desc}</span>
                </span>
                <ChevronRight className="size-5 text-(--ink)/40" aria-hidden />
              </button>
            ))}
          </div>
        </Part>
      </>
    );
  }

  if (section === "programs" && program !== null) {
    const p = c.programs;
    const it = p.items[program];
    const setItem = (next: typeof it) => set({ programs: { ...p, items: p.items.map((x, j) => (j === program ? next : x)) } });
    const blockFields: Field[] = [
      { key: "heading", type: "text", title: "Heading", hint: "For example “Highlights”." },
      {
        key: "style",
        type: "choice",
        title: "Show it as…",
        choices: [
          { value: "list", label: "A list of points" },
          { value: "text", label: "A short paragraph" },
        ],
      },
      { key: "bullets", type: "lines", title: "The points", when: (d) => d.style === "list" },
      { key: "body", type: "longtext", title: "The paragraph", when: (d) => d.style === "text" },
    ];
    const toBlock = (d: Obj) =>
      d.style === "list"
        ? { heading: String(d.heading), bullets: (d.bullets as string[]) ?? [], body: "" }
        : { heading: String(d.heading), bullets: [], body: String(d.body ?? "") };
    return (
      <div className="mt-8 space-y-6">
        {header(it.title, "One program tile and the details that open from it.", () => setProgram(null), "All programs")}
        <Part
          title="Tile"
          action={
            <EditButton
              onClick={() =>
                edit(
                  it.title,
                  [
                    { key: "title", type: "text", title: "Program name" },
                    { key: "desc", type: "text", title: "Short line on the tile" },
                    { key: "video", type: "video", title: "Video on the tile" },
                    { key: "description", type: "longtext", title: "What the program is about", hint: "Shown when someone taps Learn More." },
                  ],
                  { title: it.title, desc: it.desc, video: it.video, description: it.description },
                  (d) => setItem({ ...it, title: String(d.title), desc: String(d.desc), video: String(d.video), description: String(d.description) }),
                )
              }
            />
          }
        >
          <div className="flex items-center gap-3">
            <Thumb src={it.video} />
            <p className="text-sm text-(--ink)/70">{it.description}</p>
          </div>
        </Part>
        <Part title="Details">
          <ListRows
            items={it.blocks}
            row={(b) => ({ title: b.heading, sub: b.bullets.length ? b.bullets.join(" · ") : b.body })}
            saving={saving}
            onEdit={(i) => {
              const b = it.blocks[i];
              edit("Detail", blockFields, { heading: b.heading, style: b.bullets.length ? "list" : "text", bullets: b.bullets, body: b.body }, (d) =>
                setItem({ ...it, blocks: it.blocks.map((x, j) => (j === i ? toBlock(d) : x)) }),
              );
            }}
            onMove={(x, y) => void save(setItem({ ...it, blocks: move(it.blocks, x, y) }))}
            onRemove={(i) => void save(setItem({ ...it, blocks: it.blocks.filter((_, j) => j !== i) }))}
            addLabel="Add a detail"
            onAdd={() =>
              edit("New detail", blockFields, { heading: "", style: "list", bullets: [""], body: "" }, (d) =>
                setItem({ ...it, blocks: [...it.blocks, toBlock(d)] }),
              )
            }
          />
        </Part>
      </div>
    );
  }

  // ------------------------------------------------ get involved cards
  if (section === "actions") {
    body = (
      <Part title="Cards">
        <div className="space-y-2">
          {ACTION_ORDER.map((id) => {
            const card = c.actions[id];
            return (
              <div key={id} className="flex items-center gap-3 rounded-xl bg-white px-3 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-(--ink)">{ACTION_NAMES[id]}</p>
                  <p className="truncate text-xs text-(--ink)/55">{card.title}</p>
                </div>
                <EditButton
                  onClick={() =>
                    edit(
                      ACTION_NAMES[id],
                      [
                        { key: "eyebrow", type: "text", title: "Small line at the top" },
                        { key: "title", type: "text", title: "Heading" },
                        { key: "body", type: "longtext", title: "Text" },
                        { key: "button", type: "text", title: "Words on the button" },
                      ],
                      { ...card },
                      (d) => set({ actions: { ...c.actions, [id]: { eyebrow: String(d.eyebrow), title: String(d.title), body: String(d.body), button: String(d.button) } } }),
                    )
                  }
                />
              </div>
            );
          })}
        </div>
      </Part>
    );
  }

  // ------------------------------------------------ events
  if (section === "events") {
    const eventFields: Field[] = [
      { key: "title", type: "text", title: "Event name" },
      { key: "badge", type: "text", title: "Short tag on the ticket", hint: "A month like AUG, or ALL YEAR." },
      { key: "when", type: "text", title: "When is it?", hint: "For example “Annual — August”." },
      { key: "location", type: "text", title: "Where is it?" },
      { key: "video", type: "video", title: "Video for the event" },
      {
        key: "actionLabel",
        type: "choice",
        title: "Add a button?",
        choices: [
          { value: "Register", label: "Register" },
          { value: "Volunteer", label: "Volunteer" },
          { value: "", label: "No button" },
        ],
      },
      { key: "actionHref", type: "url", title: "Where does the button go?", hint: "Usually its Google Form link.", when: (d) => Boolean(d.actionLabel) },
    ];
    const toEvent = (d: Obj, base?: SiteContent["events"][number]) => ({
      title: String(d.title),
      badge: String(d.badge).toUpperCase(),
      when: String(d.when),
      location: String(d.location),
      video: String(d.video),
      href: base?.href ?? "#programs",
      actionLabel: (d.actionLabel as "" | "Register" | "Volunteer") ?? "",
      actionHref: d.actionLabel ? String(d.actionHref ?? "") : "",
    });
    body = (
      <Part title="Upcoming events">
        <ListRows
          items={c.events}
          row={(e) => ({ title: e.title, sub: `${e.badge} · ${e.when}`, thumb: e.video })}
          saving={saving}
          onEdit={(i) => edit("Event", eventFields, { ...c.events[i] }, (d) => set({ events: c.events.map((e, j) => (j === i ? toEvent(d, e) : e)) }))}
          onMove={(a, b) => void save(set({ events: move(c.events, a, b) }))}
          onRemove={(i) => void save(set({ events: c.events.filter((_, j) => j !== i) }))}
          addLabel="Add an event"
          onAdd={() =>
            edit(
              "New event",
              eventFields,
              { title: "", badge: "", when: "", location: "Strathcona County, AB", video: "", actionLabel: "Register", actionHref: "" },
              (d) => set({ events: [...c.events, toEvent(d)] }),
            )
          }
        />
      </Part>
    );
  }

  // ------------------------------------------------ updates
  if (section === "updates") {
    const u = c.updates;
    const updateFields: Field[] = [
      { key: "date", type: "text", title: "When was it?", hint: "For example “February 2026”." },
      { key: "title", type: "text", title: "Heading" },
      { key: "text", type: "longtext", title: "What happened?" },
      { key: "video", type: "url", title: "Add a YouTube video?", optional: true, hint: "Optional. Paste the YouTube link." },
      { key: "linkHref", type: "url", title: "Link to an article?", optional: true, hint: "Optional. Paste the web address." },
      { key: "linkLabel", type: "text", title: "Words on the link button", when: (d) => Boolean(String(d.linkHref ?? "").trim()) },
      {
        key: "dark",
        type: "choice",
        title: "Card colour",
        choices: [
          { value: "dark", label: "Black" },
          { value: "light", label: "Cream" },
        ],
      },
    ];
    const toUpdate = (d: Obj) => ({
      date: String(d.date),
      title: String(d.title),
      text: String(d.text),
      video: String(d.video ?? ""),
      linkHref: String(d.linkHref ?? ""),
      linkLabel: String(d.linkLabel ?? ""),
      dark: d.dark === "dark",
    });
    const asDraft = (x: (typeof u.items)[number]) => ({ ...x, dark: x.dark ? "dark" : "light" });
    body = (
      <>
        <Part title="News cards">
          <ListRows
            items={u.items}
            row={(x) => ({ title: x.title, sub: x.date })}
            saving={saving}
            onEdit={(i) => edit("Update", updateFields, asDraft(u.items[i]), (d) => set({ updates: { ...u, items: u.items.map((x, j) => (j === i ? toUpdate(d) : x)) } }))}
            onMove={(a, b) => void save(set({ updates: { ...u, items: move(u.items, a, b) } }))}
            onRemove={(i) => void save(set({ updates: { ...u, items: u.items.filter((_, j) => j !== i) } }))}
            addLabel="Add an update"
            onAdd={() =>
              edit(
                "New update",
                updateFields,
                { date: "", title: "", text: "", video: "", linkHref: "", linkLabel: "Read more", dark: "light" },
                (d) => set({ updates: { ...u, items: [toUpdate(d), ...u.items] } }),
              )
            }
          />
        </Part>
        <Part title="Photo strip">
          <ListRows
            items={u.photos}
            row={(src) => ({ title: "Photo", thumb: src })}
            saving={saving}
            onMove={(a, b) => void save(set({ updates: { ...u, photos: move(u.photos, a, b) } }))}
            onRemove={(i) => void save(set({ updates: { ...u, photos: u.photos.filter((_, j) => j !== i) } }))}
            addLabel="Add a photo"
            onAdd={() => edit("New photo", [PICTURE], { v: "" }, (d) => set({ updates: { ...u, photos: [...u.photos, String(d.v)] } }))}
          />
        </Part>
      </>
    );
  }

  // ------------------------------------------------ sponsors
  if (section === "sponsors") {
    const s = c.sponsors;
    body = (
      <>
        <Part
          title="Thank-you card"
          action={
            <EditButton
              onClick={() =>
                edit(
                  "Sponsors",
                  [
                    { key: "eyebrow", type: "text", title: "Small line at the top" },
                    { key: "title", type: "text", title: "Heading" },
                    { key: "text", type: "longtext", title: "Text" },
                  ],
                  { eyebrow: s.eyebrow, title: s.title, text: s.text },
                  (d) => set({ sponsors: { ...s, eyebrow: String(d.eyebrow), title: String(d.title), text: String(d.text) } }),
                )
              }
            />
          }
        >
          <p className="font-semibold text-(--ink)">{s.title}</p>
          <p className="mt-1 text-sm text-(--ink)/65">{s.text}</p>
        </Part>
        <Part title="Logos">
          <ListRows
            items={s.logos}
            row={(src) => ({ title: "Logo", thumb: src })}
            saving={saving}
            onMove={(a, b) => void save(set({ sponsors: { ...s, logos: move(s.logos, a, b) } }))}
            onRemove={(i) => void save(set({ sponsors: { ...s, logos: s.logos.filter((_, j) => j !== i) } }))}
            addLabel="Add a logo"
            onAdd={() =>
              edit("New logo", [{ key: "v", type: "image", title: "Choose the logo", hint: "A PNG with a clear background looks best." }], { v: "" }, (d) =>
                set({ sponsors: { ...s, logos: [...s.logos, String(d.v)] } }),
              )
            }
          />
        </Part>
      </>
    );
  }

  // ------------------------------------------------ board
  if (section === "board") {
    const memberFields: Field[] = [
      { key: "name", type: "text", title: "Their name" },
      { key: "designation", type: "text", title: "Their role", hint: "For example “Treasurer”." },
      { key: "src", type: "image", title: "Their photo", hint: "A portrait (taller than wide) works best." },
    ];
    const toMember = (d: Obj) => ({ name: String(d.name), designation: String(d.designation), src: String(d.src) });
    body = (
      <Part title="Board members">
        <ListRows
          items={c.board}
          row={(m) => ({ title: m.name, sub: m.designation, thumb: m.src })}
          saving={saving}
          onEdit={(i) => edit("Board member", memberFields, { ...c.board[i] }, (d) => set({ board: c.board.map((m, j) => (j === i ? toMember(d) : m)) }))}
          onMove={(a, b) => void save(set({ board: move(c.board, a, b) }))}
          onRemove={(i) => void save(set({ board: c.board.filter((_, j) => j !== i) }))}
          addLabel="Add a board member"
          onAdd={() => edit("New board member", memberFields, { name: "", designation: "", src: "" }, (d) => set({ board: [...c.board, toMember(d)] }))}
        />
      </Part>
    );
  }

  // ------------------------------------------------ contact
  if (section === "contact") {
    const k = c.contact;
    body = (
      <Part
        title="Shown at the bottom of every page"
        action={
          <EditButton
            onClick={() =>
              edit(
                "Contact details",
                [
                  { key: "email", type: "text", title: "Email address" },
                  { key: "phone", type: "text", title: "Phone number" },
                  { key: "facebook", type: "url", title: "Facebook page link", optional: true },
                  { key: "instagram", type: "url", title: "Instagram link", optional: true },
                ],
                { ...k },
                (d) => set({ contact: { email: String(d.email), phone: String(d.phone), facebook: String(d.facebook ?? ""), instagram: String(d.instagram ?? "") } }),
              )
            }
          />
        }
      >
        <p className="text-sm text-(--ink)/70">
          {k.email} · {k.phone}
          {k.facebook ? " · Facebook" : ""}
          {k.instagram ? " · Instagram" : ""}
        </p>
      </Part>
    );
  }

  return (
    <div className="mt-8 space-y-6">
      {header(meta.title, meta.sub, goSections, "All sections")}
      {body}
    </div>
  );
}
