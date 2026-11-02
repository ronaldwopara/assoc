"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Paperclip, Save, Send, Trash2, Users, X } from "lucide-react";
import type { ComposerAttachment, ComposerContent } from "@/lib/emails";
import { EmailField, EmailPreviewFrame, EventImageField, useEmailPreview } from "@/components/dashboard/email-editor";

const LISTS = [
  { id: "masterList", label: "Everyone (Master List)" },
  { id: "members", label: "Members" },
  { id: "volunteers", label: "Volunteers" },
  { id: "vendors", label: "Vendors" },
  { id: "newsletter", label: "Newsletter" },
  { id: "donors", label: "Donors" },
  { id: "contact", label: "Contact form" },
] as const;
type ListId = (typeof LISTS)[number]["id"];

const BLANK: ComposerContent = {
  subject: "",
  preheader: "",
  banner: "ASOSC",
  headline: "",
  subhead: "",
  heroUrl: "",
  body: "Hi {first_name},\n\n",
  button: { label: "", url: "" },
  attachments: [],
};

type Recipient = { email: string; name: string };
type SavedTemplate = { id: string; name: string; updated: string; content: ComposerContent };
const BATCH = 10;

function formatBytes(n: number) {
  return n > 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`;
}

/** Write an email in the ASOSC design and send it to lists of people. */
export function DashboardComposePanel() {
  const [content, setContent] = useState<ComposerContent>(BLANK);
  const [templates, setTemplates] = useState<SavedTemplate[]>([]);
  const [templateId, setTemplateId] = useState("");
  const [templateName, setTemplateName] = useState("");
  const [notice, setNotice] = useState("");

  const [lists, setLists] = useState<ListId[]>([]);
  const [memberFilter, setMemberFilter] = useState<"all" | "paid" | "unpaid">("all");
  const [extra, setExtra] = useState("");
  const [recipients, setRecipients] = useState<Recipient[] | null>(null);
  const [recipientInfo, setRecipientInfo] = useState("");
  const [loadingRecipients, setLoadingRecipients] = useState(false);

  const [testTo, setTestTo] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number; failed: Array<{ email: string; error?: string }> } | null>(null);
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const attachInput = useRef<HTMLInputElement>(null);

  const set = <K extends keyof ComposerContent>(k: K) => (v: ComposerContent[K]) => setContent((c) => ({ ...c, [k]: v }));
  const preview = useEmailPreview({ kind: "composer", content }, [JSON.stringify(content)]);

  const loadTemplates = useCallback(() => {
    fetch("/api/dashboard/compose/templates", { cache: "no-store" })
      .then((r) => r.json() as Promise<{ templates?: SavedTemplate[] }>)
      .then((d) => setTemplates(d.templates ?? []))
      .catch(() => undefined);
  }, []);
  useEffect(() => {
    loadTemplates();
  }, [loadTemplates]);

  /** Any change to who it's going to makes the last count stale. */
  const staleRecipients = () => {
    setRecipients(null);
    setRecipientInfo("");
    setConfirming(false);
  };

  const pickTemplate = (id: string) => {
    setTemplateId(id);
    const t = templates.find((x) => x.id === id);
    setContent(t ? { ...BLANK, ...t.content } : BLANK);
    setTemplateName(t?.name ?? "");
    setProgress(null);
    setNotice("");
  };

  const saveTemplate = async () => {
    setNotice("");
    try {
      const res = await fetch("/api/dashboard/compose/templates", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: templateId || undefined, name: templateName || content.subject || "Untitled", content }),
      });
      const d = (await res.json()) as { id?: string; error?: string };
      if (!res.ok || !d.id) throw new Error(d.error || "Couldn't save");
      setTemplateId(d.id);
      setNotice("Template saved.");
      loadTemplates();
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Couldn't save");
    }
  };

  const deleteTemplate = async () => {
    if (!templateId) return;
    await fetch(`/api/dashboard/compose/templates?id=${encodeURIComponent(templateId)}`, { method: "DELETE" });
    pickTemplate("");
    setNotice("Template deleted.");
    loadTemplates();
  };

  const uploadAttachment = async (file: File) => {
    setUploading(true);
    setNotice("");
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("kind", "attachment");
      const res = await fetch("/api/dashboard/compose/upload", { method: "POST", body: form });
      const d = (await res.json()) as { attachment?: ComposerAttachment; error?: string };
      if (!res.ok || !d.attachment) throw new Error(d.error || "Upload failed");
      setContent((c) => ({ ...c, attachments: [...(c.attachments ?? []), d.attachment!] }));
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
      if (attachInput.current) attachInput.current.value = "";
    }
  };

  const checkRecipients = async () => {
    setLoadingRecipients(true);
    setRecipientInfo("");
    try {
      const res = await fetch("/api/dashboard/compose/recipients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lists, memberFilter, extra }),
      });
      const d = (await res.json()) as { recipients?: Recipient[]; skippedUnsubscribed?: number; invalid?: string[]; error?: string };
      if (!res.ok || !d.recipients) throw new Error(d.error || "Couldn't load recipients");
      setRecipients(d.recipients);
      const bits = [`${d.recipients.length} ${d.recipients.length === 1 ? "person" : "people"}`];
      if (d.skippedUnsubscribed) bits.push(`${d.skippedUnsubscribed} unsubscribed skipped`);
      if (d.invalid?.length) bits.push(`ignored: ${d.invalid.join(", ")}`);
      setRecipientInfo(bits.join(" · "));
    } catch (e) {
      setRecipientInfo(e instanceof Error ? e.message : "Couldn't load recipients");
    } finally {
      setLoadingRecipients(false);
    }
  };

  const sendBatches = async (to: Recipient[], test: boolean) => {
    setSending(true);
    setConfirming(false);
    setNotice("");
    const failed: Array<{ email: string; error?: string }> = [];
    setProgress({ done: 0, total: to.length, failed });
    try {
      for (let i = 0; i < to.length; i += BATCH) {
        const batch = to.slice(i, i + BATCH);
        const res = await fetch("/api/dashboard/compose/send", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content, recipients: batch, test }),
        });
        const d = (await res.json()) as { results?: Array<{ email: string; ok: boolean; error?: string }>; error?: string };
        if (!res.ok || !d.results) throw new Error(d.error || "Send failed");
        failed.push(...d.results.filter((r) => !r.ok));
        setProgress({ done: Math.min(i + BATCH, to.length), total: to.length, failed: [...failed] });
      }
      setNotice(
        test
          ? failed.length ? `Test failed: ${failed[0].error}` : `Test sent to ${to[0].email}.`
          : `Sent to ${to.length - failed.length} of ${to.length} people.`,
      );
    } catch (e) {
      setNotice(e instanceof Error ? `${e.message}. Anything above was already sent.` : "Send failed");
    } finally {
      setSending(false);
    }
  };

  const toggleList = (id: ListId) => {
    staleRecipients();
    setLists((l) => (l.includes(id) ? l.filter((x) => x !== id) : [...l, id]));
  };
  const ready = Boolean(content.subject.trim() && content.headline.trim() && content.body.trim());
  const attachmentsTotal = useMemo(() => (content.attachments ?? []).reduce((n, a) => n + a.size, 0), [content.attachments]);

  return (
    <div className="dash-panel">
      <header className="dash-panel-head">
        <div className="dash-panel-heading">
          <h2 className="dash-panel-title">Send email</h2>
          <p className="dash-panel-sub">
            Write an email in the ASOSC design and send it to your lists. Everyone gets their own copy with an unsubscribe link.
          </p>
        </div>
        <div className="dash-panel-actions">
          <label className="dash-select-wrap">
            <span className="sr-only">Start from</span>
            <select id="compose-template" className="dash-select focus-ring-light" value={templateId} onChange={(e) => pickTemplate(e.target.value)}>
              <option value="">New email</option>
              {templates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </label>
        </div>
      </header>

      {notice && <p className="dash-interac-summary dash-muted">{notice}</p>}

      <div className="dash-email-editor" style={{ padding: "0.875rem 1.25rem 1.25rem" }}>
        <div className="dash-email-col">
          <EmailField id="compose-subject" label="Subject" value={content.subject} onChange={set("subject")} placeholder="African Festival 2027 — save the date" />
          <EmailField id="compose-preheader" label="Inbox preview text" value={content.preheader} onChange={set("preheader")} hint="Shown after the subject in most inboxes." />
          <div className="dash-email-row">
            <EmailField id="compose-banner" label="Top strip" value={content.banner} onChange={set("banner")} />
            <EmailField id="compose-headline" label="Headline" value={content.headline} onChange={set("headline")} placeholder="Save the date" />
          </div>
          <EmailField id="compose-subhead" label="Subheading" value={content.subhead} onChange={set("subhead")} placeholder="Saturday, August 14 · Broadmoor Lake Park" />
          <EventImageField id="compose-hero" value={content.heroUrl} onChange={set("heroUrl")} emptyLabel="No photo (optional)" />
          <EmailField
            id="compose-body"
            label="Message"
            value={content.body}
            onChange={set("body")}
            multiline
            rows={9}
            hint="{first_name} becomes each person's first name. Leave a blank line between paragraphs."
          />
          <div className="dash-email-row">
            <EmailField id="compose-button-label" label="Button text (optional)" value={content.button?.label ?? ""} onChange={(v) => set("button")({ label: v, url: content.button?.url ?? "" })} placeholder="Get tickets" />
            <EmailField id="compose-button-url" label="Button link" value={content.button?.url ?? ""} onChange={(v) => set("button")({ label: content.button?.label ?? "", url: v })} placeholder="https://asosc.ca/events" />
          </div>

          <div className="dash-field">
            <span>Attachments</span>
            {(content.attachments ?? []).length > 0 && (
              <ul className="dash-attachments">
                {content.attachments!.map((a) => (
                  <li key={a.url} className="dash-attachment">
                    <Paperclip size={14} aria-hidden />
                    <a href={a.url} target="_blank" rel="noreferrer">
                      {a.name}
                    </a>
                    <span className="dash-muted">{formatBytes(a.size)}</span>
                    <button
                      type="button"
                      className="dash-icon-btn dash-icon-btn--ink focus-ring-light"
                      aria-label={`Remove ${a.name}`}
                      onClick={() => set("attachments")((content.attachments ?? []).filter((x) => x.url !== a.url))}
                    >
                      <X size={14} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <div>
              <label className="dash-action-btn focus-ring-light inline-flex" htmlFor="compose-attach">
                <Paperclip size={15} />
                {uploading ? "Uploading…" : "Add attachment"}
              </label>
              <input
                ref={attachInput}
                id="compose-attach"
                type="file"
                className="sr-only"
                disabled={uploading}
                onChange={(e) => e.target.files?.[0] && uploadAttachment(e.target.files[0])}
              />
            </div>
            <span className="dash-muted dash-email-hint">
              Up to 4 MB per file, 15 MB in total{attachmentsTotal ? ` (${formatBytes(attachmentsTotal)} used)` : ""}.
            </span>
          </div>

          <div className="dash-email-row" style={{ alignItems: "flex-end", flexWrap: "wrap" }}>
            <EmailField id="compose-template-name" label="Template name" value={templateName} onChange={setTemplateName} placeholder={content.subject || "e.g. Event announcement"} />
            <button type="button" className="dash-action-btn focus-ring-light" onClick={saveTemplate}>
              <Save size={15} />
              {templateId ? "Update template" : "Save as template"}
            </button>
            {templateId && (
              <button type="button" className="dash-action-btn focus-ring-light" onClick={deleteTemplate}>
                <Trash2 size={15} />
                Delete
              </button>
            )}
          </div>

          <fieldset className="dash-recipients">
            <legend>Send to</legend>
            <div className="dash-recipient-lists">
              {LISTS.map((l) => (
                <label key={l.id} className="dash-check" htmlFor={`compose-list-${l.id}`}>
                  <input id={`compose-list-${l.id}`} type="checkbox" checked={lists.includes(l.id)} onChange={() => toggleList(l.id)} />
                  {l.label}
                </label>
              ))}
            </div>
            {lists.includes("members") && (
              <label className="dash-field" htmlFor="compose-member-filter">
                <span>Which members</span>
                <select id="compose-member-filter" className="dash-select focus-ring-light" value={memberFilter} onChange={(e) => {
                    staleRecipients();
                    setMemberFilter(e.target.value as typeof memberFilter);
                  }}>
                  <option value="all">All members</option>
                  <option value="paid">Paid only</option>
                  <option value="unpaid">Unpaid only</option>
                </select>
              </label>
            )}
            <EmailField id="compose-extra" label="Other email addresses" value={extra} onChange={(v) => {
              staleRecipients();
              setExtra(v);
            }} multiline rows={2} placeholder="name@example.com, another@example.com" />
            <div className="dash-email-row" style={{ alignItems: "center", flexWrap: "wrap" }}>
              <button
                type="button"
                className="dash-action-btn focus-ring-light"
                onClick={checkRecipients}
                disabled={loadingRecipients || (lists.length === 0 && !extra.trim())}
              >
                <Users size={15} />
                {loadingRecipients ? "Counting…" : "Count recipients"}
              </button>
              {recipientInfo && <span className="dash-muted">{recipientInfo}</span>}
            </div>
          </fieldset>

          <div className="dash-email-row" style={{ alignItems: "flex-end", flexWrap: "wrap" }}>
            <EmailField id="compose-test" label="Send a test to" value={testTo} onChange={setTestTo} placeholder="you@example.com" />
            <button
              type="button"
              className="dash-action-btn focus-ring-light"
              disabled={!ready || sending || !testTo.trim()}
              onClick={() => sendBatches([{ email: testTo.trim(), name: "" }], true)}
            >
              <Send size={15} />
              Send test
            </button>
          </div>

          {!confirming ? (
            <button
              type="button"
              className="dash-primary-btn focus-ring-light"
              disabled={!ready || sending || !recipients || recipients.length === 0}
              onClick={() => setConfirming(true)}
              title={!ready ? "Add a subject, headline and message first" : !recipients ? "Count recipients first" : undefined}
            >
              <Send size={16} />
              {recipients ? `Send to ${recipients.length} ${recipients.length === 1 ? "person" : "people"}` : "Send"}
            </button>
          ) : (
            <div className="dash-confirm">
              <p>
                Send &ldquo;{content.subject}&rdquo; to <strong>{recipients?.length}</strong> people now? This can&rsquo;t be undone.
              </p>
              <div className="dash-email-row">
                <button type="button" className="dash-primary-btn focus-ring-light" onClick={() => recipients && sendBatches(recipients, false)}>
                  Yes, send now
                </button>
                <button type="button" className="dash-action-btn focus-ring-light" onClick={() => setConfirming(false)}>
                  Cancel
                </button>
              </div>
            </div>
          )}

          {progress && progress.total > 1 && (
            <div className="dash-progress" role="status">
              <div className="dash-progress-bar">
                <span style={{ width: `${(progress.done / progress.total) * 100}%` }} />
              </div>
              <span className="dash-muted">
                {sending ? "Sending… " : ""}
                {progress.done} of {progress.total}
                {progress.failed.length ? ` · ${progress.failed.length} failed` : ""}
              </span>
              {!sending && progress.failed.length > 0 && (
                <ul className="dash-muted dash-email-hint">
                  {progress.failed.slice(0, 20).map((f) => (
                    <li key={f.email}>
                      {f.email}: {f.error}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>

        <div className="dash-email-col dash-email-col--preview">
          <p className="dash-muted" style={{ margin: 0 }}>
            Subject: <strong>{preview.subject || content.subject || "(no subject)"}</strong> · previewed for &ldquo;Ada Okafor&rdquo;
          </p>
          {preview.html ? (
            <EmailPreviewFrame html={preview.html} title="Email preview" />
          ) : (
            <div className="dash-empty">
              <p className="dash-muted">Start typing to see the email.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
