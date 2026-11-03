"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Check, Paperclip, Send, X } from "lucide-react";
import { Segmented, Busy } from "@/components/dashboard/ui";
import { HERO, type ComposerAttachment, type ComposerContent } from "@/lib/emails";
import { EmailField, EmailPreviewFrame, EventImageField, useEmailPreview } from "@/components/dashboard/email-editor";

const LISTS = [
  { id: "masterList", label: "Everyone" },
  { id: "members", label: "Members" },
  { id: "volunteers", label: "Volunteers" },
  { id: "vendors", label: "Vendors" },
  { id: "newsletter", label: "Newsletter subscribers" },
  { id: "donors", label: "Donors" },
  { id: "contact", label: "People who messaged us" },
] as const;
type ListId = (typeof LISTS)[number]["id"];

/** Starts filled in so the preview reads like a real email; every field is editable. */
const STARTER: ComposerContent = {
  subject: "What's happening at ASOSC",
  preheader: "Upcoming events and ways to get involved this season.",
  banner: "ASOSC",
  headline: "Join us this season",
  subhead: "Africans Society of Strathcona County",
  heroUrl: HERO.people,
  body:
    "Hi {first_name},\n\n" +
    "We have a few things coming up and we'd love for you to be part of them. " +
    "Bring your family, bring a friend, and come celebrate with us.\n\n" +
    "Thank you for being part of this community. We hope to see you soon.",
  button: { label: "See upcoming events", url: "https://asosc.ca/events" },
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
  const [content, setContent] = useState<ComposerContent>(STARTER);
  const [templates, setTemplates] = useState<SavedTemplate[]>([]);
  const [templateId, setTemplateId] = useState("");
  const [notice, setNotice] = useState("");
  const [sender, setSender] = useState<{ canSend: boolean; email: string } | null>(null);

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
      .then((r) => r.json() as Promise<{ templates?: SavedTemplate[]; canSend?: boolean; sender?: string }>)
      .then((d) => {
        setTemplates(d.templates ?? []);
        if (typeof d.canSend === "boolean") setSender({ canSend: d.canSend, email: d.sender ?? "support@asosc.ca" });
      })
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
    setContent(t ? { ...STARTER, ...t.content } : STARTER);
    setProgress(null);
    setNotice("");
  };

  const saveTemplate = async () => {
    setNotice("");
    try {
      const res = await fetch("/api/dashboard/compose/templates", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: templateId || undefined, name: templates.find((t) => t.id === templateId)?.name || content.subject || "Untitled", content }),
      });
      const d = (await res.json()) as { id?: string; error?: string };
      if (!res.ok || !d.id) throw new Error(d.error || "Couldn't save");
      setTemplateId(d.id);
      setNotice("Saved. You can find it under “Start from a saved email”.");
      loadTemplates();
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Couldn't save");
    }
  };

  const deleteTemplate = async () => {
    if (!templateId) return;
    await fetch(`/api/dashboard/compose/templates?id=${encodeURIComponent(templateId)}`, { method: "DELETE" });
    pickTemplate("");
    setNotice("Deleted.");
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

  async function checkRecipients() {
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
  }

  // Recount whenever who it's going to changes (debounced).
  useEffect(() => {
    if (lists.length === 0 && !extra.trim()) return;
    const timer = window.setTimeout(() => void checkRecipients(), 400);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lists, memberFilter, extra]);

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

  const count = recipients?.length ?? 0;

  const steps = [Boolean(ready), count > 0];

  return (
    <div className="dash-panel">
      <header className="dash-panel-head">
        <div className="dash-panel-heading">
          <h2 className="dash-panel-title">Send an email</h2>
          <p className="dash-panel-sub">Write it, pick who gets it, then send. Everyone gets their own copy.</p>
        </div>
      </header>

      <div className="dash-emails-body">
        {sender && !sender.canSend && (
          <div className="dash-notice">
            <span>
              You can write and preview an email, but it can&rsquo;t be sent until you sign in with <strong>{sender.email}</strong>.
            </span>
            <a className="dash-primary-btn focus-ring-light" href="/api/google/connect">
              Sign in with {sender.email}
            </a>
          </div>
        )}
        {notice && <p className="dash-notice dash-notice--plain">{notice}</p>}

        <div className="dash-compose">
          <div className="dash-compose-form">
            {templates.length > 0 && (
              <section className="dash-emails-section">
                <h3 className="dash-emails-section-title">Start from a saved email</h3>
                <div className="dash-saved">
                  <button
                    type="button"
                    className="dash-saved-card focus-ring-light"
                    aria-pressed={!templateId}
                    onClick={() => pickTemplate("")}
                  >
                    <span className="dash-saved-name">New email</span>
                    <span className="dash-saved-meta">Start fresh</span>
                  </button>
                  {templates.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      className="dash-saved-card focus-ring-light"
                      aria-pressed={templateId === t.id}
                      onClick={() => pickTemplate(t.id)}
                    >
                      <span className="dash-saved-name">{t.name}</span>
                      <span className="dash-saved-meta">Saved {t.updated.split(" ")[0]}</span>
                    </button>
                  ))}
                </div>
              </section>
            )}

            <section className="dash-emails-section">
              <StepTitle n={1} done={steps[0]}>Write your email</StepTitle>
              <EmailField id="compose-subject" label="Subject line" value={content.subject} onChange={set("subject")} />
              <EmailField id="compose-headline" label="Big heading" value={content.headline} onChange={set("headline")} />
              <EmailField id="compose-subhead" label="Line under the heading" value={content.subhead} onChange={set("subhead")} />
              <EventImageField id="compose-hero" value={content.heroUrl} onChange={set("heroUrl")} emptyLabel="No photo" />
              <EmailField id="compose-body" label="Message" value={content.body} onChange={set("body")} multiline rows={8} inserts={["first_name"]} />
              <div className="dash-email-row">
                <EmailField
                  id="compose-button-label"
                  label="Button words"
                  value={content.button?.label ?? ""}
                  onChange={(v) => set("button")({ label: v, url: content.button?.url ?? "" })}
                  hint="Leave empty if you don't want a button."
                />
                <EmailField
                  id="compose-button-url"
                  label="Where the button goes"
                  value={content.button?.url ?? ""}
                  onChange={(v) => set("button")({ label: content.button?.label ?? "", url: v })}
                  placeholder="https://asosc.ca/events"
                />
              </div>

              <div className="dash-field">
                <span className="dash-field-label">Attach files</span>
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
                <div className="dash-inline">
                  <label className="dash-action-btn focus-ring-light" htmlFor="compose-attach">
                    <Busy busy={uploading}>
                      <Paperclip size={15} aria-hidden />
                      Choose a file
                    </Busy>
                  </label>
                  <span className="dash-field-hint">PDFs, pictures or documents, up to 4 MB each.</span>
                </div>
                <input
                  ref={attachInput}
                  id="compose-attach"
                  type="file"
                  className="sr-only"
                  disabled={uploading}
                  onChange={(e) => e.target.files?.[0] && uploadAttachment(e.target.files[0])}
                />
                {attachmentsTotal > 0 && <span className="dash-field-hint">{formatBytes(attachmentsTotal)} of 15 MB used.</span>}
              </div>

              <details className="dash-more">
                <summary>More options</summary>
                <EmailField id="compose-preheader" label="Preview text in the inbox" value={content.preheader} onChange={set("preheader")} />
                <EmailField id="compose-banner" label="Small text along the top" value={content.banner} onChange={set("banner")} />
              </details>
            </section>

            <section className="dash-emails-section">
              <StepTitle n={2} done={steps[1]}>Choose who gets it</StepTitle>
              <div className="dash-chip-checks">
                {LISTS.map((l) => (
                  <label key={l.id} className="dash-chip-check" htmlFor={`compose-list-${l.id}`}>
                    <input id={`compose-list-${l.id}`} type="checkbox" className="sr-only" checked={lists.includes(l.id)} onChange={() => toggleList(l.id)} />
                    <Check size={14} aria-hidden className="dash-chip-check-icon" />
                    {l.label}
                  </label>
                ))}
              </div>
              {lists.includes("members") && (
                <div className="dash-field">
                  <span className="dash-field-label">Which members?</span>
                  <Segmented
                    label="Which members"
                    value={memberFilter}
                    onChange={(v) => {
                      staleRecipients();
                      setMemberFilter(v);
                    }}
                    options={[
                      { value: "all", label: "All of them" },
                      { value: "paid", label: "Paid" },
                      { value: "unpaid", label: "Not paid yet" },
                    ]}
                  />
                </div>
              )}
              <EmailField
                id="compose-extra"
                label="Anyone else? (optional)"
                value={extra}
                onChange={(v) => {
                  staleRecipients();
                  setExtra(v);
                }}
                placeholder="Type email addresses, separated by commas"
              />
              <p className="dash-count" role="status">
                {loadingRecipients
                  ? "Counting…"
                  : count > 0
                    ? (
                      <>
                        This will go to <strong>{count} {count === 1 ? "person" : "people"}</strong>.
                        {recipientInfo.includes("unsubscribed") ? " People who unsubscribed are left out." : ""}
                      </>
                    )
                    : recipientInfo && lists.length + extra.trim().length > 0
                      ? "Nobody found in those lists."
                      : "Pick at least one group above."}
              </p>
            </section>

            <section className="dash-emails-section">
              <StepTitle n={3} done={false}>Send it</StepTitle>
              <div className="dash-field">
                <label htmlFor="compose-test">Send yourself a test first</label>
                <div className="dash-inline">
                  <input
                    id="compose-test"
                    className="dash-input focus-ring-light"
                    type="email"
                    placeholder="Your email address"
                    value={testTo}
                    onChange={(e) => setTestTo(e.target.value)}
                  />
                  <button
                    type="button"
                    className="dash-action-btn focus-ring-light"
                    disabled={!ready || sending || !testTo.trim() || sender?.canSend === false}
                    onClick={() => sendBatches([{ email: testTo.trim(), name: "" }], true)}
                  >
                    Send test
                  </button>
                </div>
              </div>

              {!confirming ? (
                <div className="dash-savebar dash-savebar--inline">
                  <button
                    type="button"
                    className="dash-primary-btn dash-inline-btn focus-ring-light"
                    disabled={!ready || sending || count === 0 || sender?.canSend === false}
                    onClick={() => setConfirming(true)}
                  >
                    <Send size={16} aria-hidden />
                    {count ? `Send to ${count} ${count === 1 ? "person" : "people"}` : "Send"}
                  </button>
                  <button type="button" className="dash-text-btn focus-ring-light" onClick={saveTemplate}>
                    {templateId ? "Save changes for later" : "Save for later"}
                  </button>
                  {templateId && (
                    <button type="button" className="dash-text-btn dash-text-btn--danger focus-ring-light" onClick={deleteTemplate}>
                      Delete saved email
                    </button>
                  )}
                </div>
              ) : (
                <div className="dash-confirm">
                  <p>
                    Send &ldquo;{content.subject}&rdquo; to <strong>{count} {count === 1 ? "person" : "people"}</strong> now? You can&rsquo;t unsend it.
                  </p>
                  <div className="dash-savebar dash-savebar--inline">
                    <button type="button" className="dash-primary-btn focus-ring-light" onClick={() => recipients && sendBatches(recipients, false)}>
                      Yes, send it
                    </button>
                    <button type="button" className="dash-text-btn focus-ring-light" onClick={() => setConfirming(false)}>
                      Not yet
                    </button>
                  </div>
                </div>
              )}

              {!ready && <p className="dash-field-hint">Add a subject line, a big heading and a message before sending.</p>}

              {progress && progress.total > 1 && (
                <div className="dash-progress" role="status">
                  <div className="dash-progress-bar">
                    <span style={{ width: `${(progress.done / progress.total) * 100}%` }} />
                  </div>
                  <span className="dash-field-hint">
                    {sending ? "Sending… " : "Done. "}
                    {progress.done} of {progress.total}
                    {progress.failed.length ? `, ${progress.failed.length} couldn't be sent` : ""}
                  </span>
                  {!sending && progress.failed.length > 0 && (
                    <ul className="dash-field-hint">
                      {progress.failed.slice(0, 20).map((f) => (
                        <li key={f.email}>
                          {f.email}: {f.error}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </section>
          </div>

          <aside className="dash-compose-preview">
            <div className="dash-preview-sticky">
            <p className="dash-preview-label">What they&rsquo;ll see</p>
            {preview.html ? (
              <EmailPreviewFrame html={preview.html} title="Email preview" />
            ) : (
              <p className="dash-field-hint">Loading preview…</p>
            )}
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}

function StepTitle({ n, done, children }: { n: number; done: boolean; children: React.ReactNode }) {
  return (
    <h3 className="dash-step-title">
      <span className="dash-step-num" data-done={done || undefined} aria-hidden>
        {done ? <Check size={14} /> : n}
      </span>
      {children}
    </h3>
  );
}
