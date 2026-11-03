"use client";

import { Upload, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

/** Plain-language names for the {placeholders} an email can use. */
export const PLACEHOLDER_LABELS: Record<string, string> = {
  first_name: "First name",
  category: "Membership type",
  payment_code: "Payment code",
  amount: "Amount",
  business: "Business name",
  invoice_number: "Invoice number",
};

/** One labelled text input or textarea in the email editor. `inserts` adds
 *  buttons that drop a personal detail (e.g. their first name) in at the cursor. */
export function EmailField({
  id,
  label,
  value,
  onChange,
  multiline,
  rows = 6,
  hint,
  placeholder,
  inserts,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  multiline?: boolean;
  rows?: number;
  hint?: string;
  placeholder?: string;
  inserts?: string[];
}) {
  const ref = useRef<HTMLTextAreaElement & HTMLInputElement>(null);
  const insert = (key: string) => {
    const el = ref.current;
    const token = `{${key}}`;
    const start = el?.selectionStart ?? value.length;
    const end = el?.selectionEnd ?? value.length;
    onChange(value.slice(0, start) + token + value.slice(end));
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(start + token.length, start + token.length);
    });
  };
  return (
    <div className="dash-field">
      <label htmlFor={id}>{label}</label>
      {multiline ? (
        <textarea
          ref={ref}
          id={id}
          className="dash-email-textarea"
          rows={rows}
          value={value}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
        />
      ) : (
        <input ref={ref} id={id} type="text" value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
      )}
      {inserts && inserts.length > 0 && (
        <div className="dash-inserts">
          <span>Add their:</span>
          {inserts.map((k) => (
            <button key={k} type="button" className="dash-insert focus-ring-light" onClick={() => insert(k)}>
              {PLACEHOLDER_LABELS[k] ?? k}
            </button>
          ))}
        </div>
      )}
      {hint && <span className="dash-field-hint">{hint}</span>}
    </div>
  );
}

type GalleryAlbum = { title: string; photos: string[] };

/** Small, fast version of a Cloudinary photo for thumbnails. */
function thumb(url: string, w = 320, h = 220): string {
  return /res\.cloudinary\.com\/[^/]+\/image\/upload\//.test(url)
    ? url.replace("/image/upload/", `/image/upload/c_fill,g_auto,w_${w},h_${h},f_auto,q_auto/`)
    : url;
}

/** Pick the email's photo: from the website's gallery, or uploaded from the computer. */
export function EventImageField({
  id,
  value,
  onChange,
  emptyLabel = "No photo",
  fallbackUrl,
}: {
  id: string;
  value: string;
  onChange: (url: string) => void;
  emptyLabel?: string;
  /** Photo used when none is chosen (shown so nobody wonders what goes out). */
  fallbackUrl?: string;
}) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [galleryOpen, setGalleryOpen] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  const upload = async (file: File) => {
    setUploading(true);
    setError("");
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("kind", "image");
      const res = await fetch("/api/dashboard/compose/upload", { method: "POST", body: form });
      const data = (await res.json()) as { url?: string; error?: string };
      if (!res.ok || !data.url) throw new Error(data.error || "Upload failed");
      onChange(data.url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
      if (input.current) input.current.value = "";
    }
  };

  const shown = value || fallbackUrl;

  return (
    <div className="dash-field">
      <span className="dash-field-label">Photo</span>
      <div className="dash-image-field">
        <div className="dash-image-frame">
          {shown ? (
            // eslint-disable-next-line @next/next/no-img-element -- remote Cloudinary preview thumbnail
            <img src={thumb(shown, 440, 260)} alt="" className="dash-image-thumb" />
          ) : (
            <span className="dash-image-empty">{emptyLabel}</span>
          )}
          {uploading && (
            <span className="dash-image-uploading">
              <span className="dash-spinner" role="status" aria-label="Uploading" />
            </span>
          )}
          {value && !uploading && (
            <button
              type="button"
              className="dash-image-remove focus-ring-light"
              onClick={() => onChange("")}
              aria-label={fallbackUrl ? "Go back to the standard photo" : "Remove photo"}
              title={fallbackUrl ? "Go back to the standard photo" : "Remove photo"}
            >
              <X size={14} aria-hidden />
            </button>
          )}
        </div>
        <button type="button" className="dash-action-btn focus-ring-light" onClick={() => setGalleryOpen(true)} disabled={uploading}>
          {shown ? "Change photo" : "Add a photo"}
        </button>
        <input
          ref={input}
          id={id}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif,image/heic"
          className="sr-only"
          tabIndex={-1}
          disabled={uploading}
          onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])}
        />
      </div>
      {error && <p className="dash-error">{error}</p>}
      {galleryOpen && (
        <GalleryPicker
          current={value}
          onClose={() => setGalleryOpen(false)}
          onUpload={() => {
            setGalleryOpen(false);
            input.current?.click();
          }}
          onPick={(url) => {
            onChange(url);
            setGalleryOpen(false);
          }}
        />
      )}
    </div>
  );
}

function GalleryPicker({
  current,
  onPick,
  onUpload,
  onClose,
}: {
  current: string;
  onPick: (url: string) => void;
  onUpload: () => void;
  onClose: () => void;
}) {
  const [albums, setAlbums] = useState<GalleryAlbum[] | null>(null);
  const [error, setError] = useState("");
  const [album, setAlbum] = useState(0);
  const dialog = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/dashboard/gallery-photos", { cache: "no-store" })
      .then((r) => r.json() as Promise<{ albums?: GalleryAlbum[]; error?: string }>)
      .then((d) => (d.albums ? setAlbums(d.albums) : setError(d.error || "Couldn't load the gallery")))
      .catch(() => setError("Couldn't load the gallery"));
  }, []);

  useEffect(() => {
    dialog.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const photos = albums?.[album]?.photos ?? [];

  return (
    <div className="dash-modal-backdrop" onClick={onClose}>
      <div
        ref={dialog}
        className="dash-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Choose a photo from the gallery"
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="dash-modal-head">
          <h3 className="dash-emails-section-title">Choose a photo</h3>
          <button type="button" className="dash-text-btn focus-ring-light" onClick={onClose}>
            Close
          </button>
        </div>
        {error && <p className="dash-field-hint" style={{ padding: "0 1.25rem" }}>{error}</p>}
        {!albums && !error && <p className="dash-field-hint" style={{ padding: "0 1.25rem" }}>Loading photos…</p>}
        {albums && albums.length === 0 && (
          <div className="dash-photo-grid">
            <button type="button" className="dash-photo dash-photo--upload focus-ring-light" onClick={onUpload}>
              <Upload size={20} aria-hidden />
              Upload from your computer
            </button>
          </div>
        )}
        {albums && albums.length > 0 && (
          <>
            <div className="dash-modal-albums" role="tablist" aria-label="Events">
              {albums.map((a, i) => (
                <button
                  key={a.title}
                  type="button"
                  role="tab"
                  aria-selected={i === album}
                  className="dash-album-tab focus-ring-light"
                  onClick={() => setAlbum(i)}
                >
                  {a.title}
                </button>
              ))}
            </div>
            <div className="dash-photo-grid">
              {album === 0 && (
                <button type="button" className="dash-photo dash-photo--upload focus-ring-light" onClick={onUpload}>
                  <Upload size={20} aria-hidden />
                  Upload from your computer
                </button>
              )}
              {photos.map((src) => (
                <button
                  key={src}
                  type="button"
                  className="dash-photo focus-ring-light"
                  aria-pressed={Boolean(current) && src === current}
                  onClick={() => onPick(src)}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element -- Cloudinary thumbnail */}
                  <img src={thumb(src, 400, 260)} alt="" loading="lazy" />
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/** Server-rendered live preview of unsaved edits (debounced). */
export function useEmailPreview(body: unknown, deps: unknown[]) {
  const [html, setHtml] = useState("");
  const [subject, setSubject] = useState("");
  useEffect(() => {
    const timer = window.setTimeout(() => {
      fetch("/api/dashboard/emails/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
        .then((res) => res.json() as Promise<{ html?: string; subject?: string }>)
        .then((d) => {
          if (d.html) setHtml(d.html);
          if (d.subject) setSubject(d.subject);
        })
        .catch(() => undefined);
    }, 350);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return { html, subject };
}

/** Narrowest width the email layout is designed for; smaller previews are scaled down instead. */
const MIN_EMAIL_WIDTH = 360;

/** Email preview frame that resizes to the email's height (and scales down on narrow screens). */
export function EmailPreviewFrame({ html, title }: { html: string; title: string }) {
  const box = useRef<HTMLDivElement>(null);
  const frame = useRef<HTMLIFrameElement>(null);
  const fit = () => {
    const f = frame.current;
    const b = box.current;
    const doc = f?.contentDocument;
    if (!f || !b || !doc) return;
    const available = b.clientWidth;
    const scale = available > 0 && available < MIN_EMAIL_WIDTH ? available / MIN_EMAIL_WIDTH : 1;
    f.style.width = scale < 1 ? `${MIN_EMAIL_WIDTH}px` : "100%";
    f.style.transform = scale < 1 ? `scale(${scale})` : "";
    f.style.minHeight = scale < 1 ? "0" : "";
    f.style.height = "0px";
    const article = doc.querySelector('[role="article"]') ?? doc.body;
    const height = Math.floor(article.getBoundingClientRect().bottom);
    f.style.height = `${height}px`;
    // A transform doesn't shrink the layout box, so pull the space it leaves back up.
    f.style.marginBottom = scale < 1 ? `${-Math.ceil(height * (1 - scale))}px` : "";
  };
  return (
    <div className="dash-email-preview" ref={box}>
      <iframe
        ref={frame}
        title={title}
        className="dash-email-preview-frame"
        sandbox="allow-same-origin"
        srcDoc={html}
        onLoad={fit}
      />
    </div>
  );
}
