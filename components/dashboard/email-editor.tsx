"use client";

import { useEffect, useRef, useState } from "react";
import { ImagePlus, X } from "lucide-react";

/** One labelled text input or textarea in the email editor. */
export function EmailField({
  id,
  label,
  value,
  onChange,
  multiline,
  rows = 6,
  hint,
  placeholder,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  multiline?: boolean;
  rows?: number;
  hint?: string;
  placeholder?: string;
}) {
  return (
    <label className="dash-field" htmlFor={id}>
      <span>{label}</span>
      {multiline ? (
        <textarea
          id={id}
          className="dash-email-textarea"
          rows={rows}
          value={value}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
        />
      ) : (
        <input id={id} type="text" value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
      )}
      {hint && <span className="dash-muted dash-email-hint">{hint}</span>}
    </label>
  );
}

/** Upload an event photo for the email's header image. */
export function EventImageField({
  id,
  value,
  onChange,
  emptyLabel = "No photo",
}: {
  id: string;
  value: string;
  onChange: (url: string) => void;
  emptyLabel?: string;
}) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
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

  return (
    <div className="dash-field">
      <span>Event photo</span>
      <div className="dash-image-field">
        {value ? (
          // eslint-disable-next-line @next/next/no-img-element -- remote Cloudinary preview thumbnail
          <img src={value} alt="" className="dash-image-thumb" />
        ) : (
          <span className="dash-image-empty dash-muted">{emptyLabel}</span>
        )}
        <div className="dash-image-actions">
          <label className="dash-action-btn focus-ring-light" htmlFor={id}>
            <ImagePlus size={15} />
            {uploading ? "Uploading…" : value ? "Replace" : "Upload photo"}
          </label>
          <input
            ref={input}
            id={id}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif,image/heic"
            className="sr-only"
            disabled={uploading}
            onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])}
          />
          {value && (
            <button type="button" className="dash-action-btn focus-ring-light" onClick={() => onChange("")}>
              <X size={15} />
              Remove
            </button>
          )}
        </div>
      </div>
      {error && <p className="dash-error">{error}</p>}
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

/** Email preview frame that resizes to the email's height. */
export function EmailPreviewFrame({ html, title }: { html: string; title: string }) {
  const frame = useRef<HTMLIFrameElement>(null);
  const fit = () => {
    const f = frame.current;
    const doc = f?.contentDocument;
    if (!f || !doc) return;
    f.style.height = "0px";
    const article = doc.querySelector('[role="article"]') ?? doc.body;
    f.style.height = `${Math.floor(article.getBoundingClientRect().bottom)}px`;
  };
  return (
    <div className="dash-email-preview">
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
