"use client";

import { Busy, Segmented } from "@/components/dashboard/ui";
import { useCallback, useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Send } from "lucide-react";
import { parseSheetDate } from "@/lib/sheet-dates";
import { EmailField, EmailPreviewFrame, EventImageField, useEmailPreview } from "@/components/dashboard/email-editor";

type Copy = {
  subject: string;
  preheader: string;
  banner: string;
  headline: string;
  subhead: string;
  intro: string;
  outro: string;
  heroUrl?: string;
};
type Template = {
  id: string;
  label: string;
  when: string;
  placeholders: string[];
  defaultHero: string;
  edited: boolean;
  copy: Copy;
  defaults: Copy;
  subject: string;
  html: string;
};
type Pending = { tab: string; rowNumber: number; name: string; email: string; timestamp: string };
type EmailsResponse = {
  sender?: string;
  canSend?: boolean;
  autoSend?: boolean;
  templates?: Template[];
  pending?: Pending[];
  error?: string;
};

function formatTime(value: string): string {
  const parsed = parseSheetDate(value);
  return parsed ? parsed.toLocaleString("en-CA", { dateStyle: "medium", timeStyle: "short" }) : value || "";
}

/** Sending status, template previews, and signups still waiting for their confirmation email. */
export function DashboardEmailsPanel() {
  const [data, setData] = useState<EmailsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [sending, setSending] = useState("");
  const [notice, setNotice] = useState("");
  const [toggling, setToggling] = useState(false);

  const toggleAutoSend = async () => {
    if (!data) return;
    const next = !data.autoSend;
    setToggling(true);
    setNotice("");
    try {
      const res = await fetch("/api/dashboard/emails", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ autoSend: next }),
      });
      const d = (await res.json()) as { error?: string };
      if (!res.ok || d.error) throw new Error(d.error || "Couldn't change the setting");
      setData((prev) => (prev ? { ...prev, autoSend: next } : prev));
      setNotice(
        next
          ? "Emails are on."
          : "Emails are paused.",
      );
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Couldn't change the setting");
    } finally {
      setToggling(false);
    }
  };

  const load = useCallback(() => {
    setLoading(true);
    setError("");
    fetch("/api/dashboard/emails", { cache: "no-store" })
      .then((res) => res.json() as Promise<EmailsResponse>)
      .then((d) => (d.error ? setError(d.error) : setData(d)))
      .catch(() => setError("Failed to load emails."))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const send = async (p: Pending) => {
    const key = `${p.tab}:${p.rowNumber}`;
    setSending(key);
    setNotice("");
    try {
      const res = await fetch("/api/dashboard/emails", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tab: p.tab, rowNumber: p.rowNumber }),
      });
      const d = (await res.json()) as { to?: string; error?: string };
      if (!res.ok || d.error) throw new Error(d.error || "Couldn't send");
      setNotice(`Sent to ${d.to}.`);
      setData((prev) =>
        prev ? { ...prev, pending: prev.pending?.filter((x) => `${x.tab}:${x.rowNumber}` !== key) } : prev,
      );
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Couldn't send");
    } finally {
      setSending("");
    }
  };

  const open = data?.templates?.find((t) => t.id === openId) ?? null;
  const pending = data?.pending ?? [];

  return (
    <div className="dash-panel">
      <header className="dash-panel-head">
        <div className="dash-panel-heading">
          {open && (
            <button type="button" className="dash-back focus-ring-light" onClick={() => setOpenId(null)}>
              <ChevronLeft size={16} aria-hidden />
              Back
            </button>
          )}
          {open && <p className="dash-eyebrow">{personFor(open.id)}</p>}
          <h2 className="dash-panel-title">{open ? EMAILS[open.id]?.name ?? open.label : "Automatic emails"}</h2>
          <p className="dash-panel-sub">
            {open
              ? EMAILS[open.id]?.about ?? ""
              : "What people get by email when they sign up, when they pay, and if they still need to pay."}
          </p>
        </div>
      </header>

      <div className="dash-emails-body">
        {loading && !data && <p className="dash-emails-section dash-muted">Loading…</p>}

        {error && (
          <div className="dash-notice">
            <span>Something went wrong loading this page.</span>
            <button type="button" className="dash-action-btn focus-ring-light" onClick={load}>
              Try again
            </button>
          </div>
        )}

        {notice && <p className="dash-notice dash-notice--plain">{notice}</p>}

        {data && open && (
          <AutoEmailEditor
            key={open.id}
            template={open}
            onSaved={(copy, edited) =>
              setData((prev) =>
                prev ? { ...prev, templates: prev.templates?.map((t) => (t.id === open.id ? { ...t, copy, edited } : t)) } : prev,
              )
            }
          />
        )}

        {data && !open && (
          <>
            {!data.canSend ? (
              <div className="dash-notice">
                <span>
                  Emails aren&rsquo;t going out yet. Sign in with <strong>{data.sender}</strong> once so the website can send from it.
                </span>
                <a className="dash-primary-btn focus-ring-light" href="/api/google/connect?account=support%40asosc.ca">
                  Sign in with {data.sender}
                </a>
              </div>
            ) : (
              <div className={data.autoSend ? "dash-notice dash-notice--on" : "dash-notice"}>
                <span>
                  {data.autoSend
                    ? "Emails are on. People get these by themselves."
                    : "Emails are paused. Nobody gets these until you turn them on."}
                </span>
                <button
                  type="button"
                  className={data.autoSend ? "dash-action-btn focus-ring-light" : "dash-primary-btn focus-ring-light"}
                  onClick={toggleAutoSend}
                  disabled={toggling}
                >
                  <Busy busy={toggling}>{data.autoSend ? "Pause emails" : "Turn emails on"}</Busy>
                </button>
              </div>
            )}

            {pending.length > 0 && (
              <section className="dash-emails-section">
                <div>
                  <h3 className="dash-emails-section-title">
                    {pending.length === 1 ? "1 person is waiting for their email" : `${pending.length} people are waiting for their email`}
                  </h3>
                  <p className="dash-section-lead">They filled in a form while emails were paused.</p>
                </div>
                <ul className="dash-email-list">
                  {pending.map((p) => {
                    const key = `${p.tab}:${p.rowNumber}`;
                    return (
                      <li key={key} className="dash-email-item dash-email-item--static">
                        <span className="dash-email-item-text">
                          <span className="dash-email-item-name">{p.name || p.email}</span>
                          <span className="dash-email-item-meta">
                            {p.tab === "Master List" ? "Membership" : p.tab}, {formatTime(p.timestamp)}
                          </span>
                        </span>
                        <button
                          type="button"
                          className="dash-action-btn focus-ring-light"
                          onClick={() => send(p)}
                          disabled={!data.canSend || Boolean(sending)}
                        >
                          <Busy busy={sending === key}>
                            <Send size={15} aria-hidden />
                            Send it now
                          </Busy>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </section>
            )}

            {PEOPLE.map((group) => {
              const items = group.ids
                .map((id) => (data.templates ?? []).find((t) => t.id === id))
                .filter((t): t is Template => Boolean(t));
              if (!items.length) return null;
              return (
                <section key={group.title} className="dash-emails-section">
                  <h3 className="dash-emails-section-title">{group.title}</h3>
                  <ul className="dash-email-list">
                    {items.map((t) => (
                      <li key={t.id}>
                        <button type="button" className="dash-email-item focus-ring-light" onClick={() => setOpenId(t.id)}>
                          <span className="dash-email-item-text">
                            <span className="dash-email-item-name">
                              {EMAILS[t.id]?.name ?? t.label}
                              {t.edited && <span className="dash-tag">Edited</span>}
                            </span>
                            <span className="dash-email-item-meta">{EMAILS[t.id]?.about}</span>
                          </span>
                          <ChevronRight size={18} aria-hidden className="dash-email-item-chevron" />
                        </button>
                      </li>
                    ))}
                  </ul>
                  {group.title === "Events" && <EventFormsCard />}
                </section>
              );
            })}

            <section className="dash-emails-section">
              <h3 className="dash-emails-section-title">Reminders</h3>
              <RemindersCard autoSend={Boolean(data.autoSend)} canSend={Boolean(data.canSend)} />
            </section>
          </>
        )}
      </div>
    </div>
  );
}

/** Each email, named by the moment it goes out, with what it does. */
const EMAILS: Record<string, { name: string; about: string }> = {
  membership: { name: "When they sign up", about: "Thanks them and explains how to pay for their membership." },
  "paid-membership": { name: "When they pay", about: "Confirms their membership is active and sends their receipt." },
  "reminder-membership": { name: "If they haven't paid", about: "A friendly reminder to finish paying for their membership." },
  donation: { name: "When they fill in the donation form", about: "Thanks them and explains how to send their donation." },
  "paid-donation": { name: "When their donation arrives", about: "Thanks them and sends their receipt." },
  "reminder-donation": { name: "If their donation hasn't arrived", about: "A gentle reminder about the donation they planned." },
  vendor: { name: "When they apply", about: "Lets them know we got their application." },
  "vendor-approved": { name: "When you approve them", about: "Sent when you set their status to Approved on the Vendors page. Tells them the fee and how to pay." },
  "paid-vendor": { name: "When they pay", about: "Confirms their vendor fee and sends their receipt." },
  "reminder-vendor": { name: "If they haven't paid", about: "A reminder to pay their vendor fee." },
  volunteer: { name: "When they sign up", about: "Thanks them for offering to help. Also sent to people who sign up through an event's volunteer Google Form." },
  event: { name: "When they register for an event", about: "Confirms their spot. Sent to people who register through an event's Google Form." },
  newsletter: { name: "When someone subscribes", about: "Welcomes them to the newsletter." },
  contact: { name: "When someone sends us a message", about: "Lets them know we got it and will reply." },
  invoice: { name: "When you send a receipt", about: "Sent when you email a receipt from the Receipts or Payments page. The PDF is attached." },
};

/** Grouped by the person getting the email, in the order they'd get them. */
const PEOPLE: Array<{ title: string; ids: string[] }> = [
  { title: "Members", ids: ["membership", "paid-membership", "reminder-membership"] },
  { title: "Donors", ids: ["donation", "paid-donation", "reminder-donation"] },
  { title: "Vendors", ids: ["vendor", "vendor-approved", "paid-vendor", "reminder-vendor"] },
  { title: "Volunteers", ids: ["volunteer"] },
  { title: "Events", ids: ["event"] },
  { title: "Newsletter and messages", ids: ["newsletter", "contact"] },
  { title: "Invoices & receipts", ids: ["invoice-due", "invoice"] },
];

function personFor(id: string): string {
  return PEOPLE.find((g) => g.ids.includes(id))?.title ?? "";
}

/** Edit one automatic email's wording and photo, with a live preview. Payment details are filled in automatically. */
function AutoEmailEditor({ template, onSaved }: { template: Template; onSaved: (copy: Copy, edited: boolean) => void }) {
  const [copy, setCopy] = useState<Copy>(template.copy);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState("");
  const set = (k: keyof Copy) => (v: string) => setCopy((c) => ({ ...c, [k]: v }));
  const preview = useEmailPreview({ kind: "auto", id: template.id, copy }, [template.id, JSON.stringify(copy)]);
  const dirty = JSON.stringify(copy) !== JSON.stringify(template.copy);
  const f = (k: keyof Copy) => `email-${template.id}-${k}`;
  const inserts = template.placeholders;
  const insertLabels: Record<string, string> | undefined = undefined;

  const save = async () => {
    setSaving(true);
    setStatus("");
    try {
      const res = await fetch("/api/dashboard/emails", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: template.id, copy }),
      });
      const d = (await res.json()) as { error?: string };
      if (!res.ok || d.error) throw new Error(d.error || "Couldn't save");
      onSaved(copy, true);
      setStatus("Saved. The next email will use this.");
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Couldn't save");
    } finally {
      setSaving(false);
    }
  };

  const reset = async () => {
    setSaving(true);
    setStatus("");
    try {
      const res = await fetch(`/api/dashboard/emails?id=${encodeURIComponent(template.id)}`, { method: "DELETE" });
      const d = (await res.json()) as { error?: string };
      if (!res.ok || d.error) throw new Error(d.error || "Couldn't reset");
      const defaults = { ...template.defaults, heroUrl: "" };
      setCopy(defaults);
      onSaved(defaults, false);
      setStatus("Back to the original");
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Couldn't reset");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="dash-compose">
      <div className="dash-compose-form">
        <section className="dash-emails-section">
          <h3 className="dash-step-title">Write the email</h3>
          <EmailField id={f("subject")} label="Subject line" value={copy.subject} onChange={set("subject")} inserts={inserts} insertLabels={insertLabels} />
          <EmailField id={f("headline")} label="Big heading" value={copy.headline} onChange={set("headline")} />
          <EmailField id={f("subhead")} label="Line under the heading" value={copy.subhead} onChange={set("subhead")} />
          <EventImageField id={f("heroUrl")} value={copy.heroUrl ?? ""} onChange={set("heroUrl")} fallbackUrl={template.defaultHero} />
          <EmailField id={f("intro")} label="Message" value={copy.intro} onChange={set("intro")} multiline rows={6} inserts={inserts} insertLabels={insertLabels} />
          <EmailField
            id={f("outro")}
            label="Closing message"
            value={copy.outro}
            onChange={set("outro")}
            multiline
            rows={4}
            inserts={inserts}
            insertLabels={insertLabels}
            hint="Comes after the payment details, which are filled in for you."
          />
          <details className="dash-more">
            <summary>More options</summary>
            <EmailField id={f("preheader")} label="Preview text in the inbox" value={copy.preheader} onChange={set("preheader")} inserts={inserts} insertLabels={insertLabels} />
            <EmailField id={f("banner")} label="Small text along the top" value={copy.banner} onChange={set("banner")} />
          </details>
          <div className="dash-savebar dash-savebar--inline">
          <button type="button" className="dash-primary-btn focus-ring-light" onClick={save} disabled={saving || !dirty}>
            <Busy busy={saving}>Save changes</Busy>
          </button>
          {template.edited && (
            <button type="button" className="dash-text-btn focus-ring-light" onClick={reset} disabled={saving}>
              Go back to the original wording
            </button>
          )}
          {status && <span className="dash-savebar-status">{status}</span>}
          </div>
        </section>
      </div>
      <aside className="dash-compose-preview">
            <div className="dash-preview-sticky">
        <p className="dash-preview-label">What they&rsquo;ll see</p>
        <EmailPreviewFrame html={preview.html || template.html} title={`${template.label} preview`} />
        </div>
      </aside>
    </div>
  );
}

type Schedule = { daysBetween: number; perRound: number; pauseDays: number; rounds: number };
/** What the dashboard shows: one plain rule. */
type SimpleSchedule = { every: number; stopAfter: number };

function simplify(s: Schedule): SimpleSchedule {
  return { every: s.daysBetween, stopAfter: Math.min(10, s.perRound * s.rounds) };
}

/** How often unpaid people are reminded (stored in the master sheet's Settings tab), plus a manual run. */
function RemindersCard({ autoSend, canSend }: { autoSend: boolean; canSend: boolean }) {
  const [rule, setRule] = useState<SimpleSchedule | null>(null);
  const [saved, setSaved] = useState<SimpleSchedule | null>(null);
  const [busy, setBusy] = useState("");
  const [status, setStatus] = useState("");

  useEffect(() => {
    fetch("/api/dashboard/reminders", { cache: "no-store" })
      .then((r) => r.json() as Promise<{ schedule?: Schedule }>)
      .then((d) => {
        if (d.schedule) {
          setRule(simplify(d.schedule));
          setSaved(simplify(d.schedule));
        }
      })
      .catch(() => setStatus("Couldn't load the reminder settings."));
  }, []);

  const setNum = (k: keyof SimpleSchedule) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setRule((r) => (r ? { ...r, [k]: Number(e.target.value) } : r));

  const save = async () => {
    if (!rule) return;
    setBusy("save");
    setStatus("");
    try {
      const res = await fetch("/api/dashboard/reminders", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ daysBetween: rule.every, perRound: rule.stopAfter, pauseDays: rule.every, rounds: 1 }),
      });
      const d = (await res.json()) as { schedule?: Schedule; error?: string };
      if (!res.ok || !d.schedule) throw new Error(d.error || "Couldn't save");
      setRule(simplify(d.schedule));
      setSaved(simplify(d.schedule));
      setStatus("Saved");
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Couldn't save");
    } finally {
      setBusy("");
    }
  };

  const runNow = async () => {
    setBusy("run");
    setStatus("");
    try {
      const res = await fetch("/api/dashboard/reminders", { method: "POST" });
      const d = (await res.json()) as { approvals?: number; reminders?: Record<string, number>; errors?: string[]; error?: string };
      if (!res.ok || d.error) throw new Error(d.error || "Couldn't send");
      const r = d.reminders ?? {};
      const total = (r.membership ?? 0) + (r.donation ?? 0) + (r.vendor ?? 0) + (d.approvals ?? 0);
      setStatus(
        total === 0
          ? "Nobody is due a reminder today."
          : `Sent ${total} email${total === 1 ? "" : "s"}.` + (d.errors?.length ? ` ${d.errors.length} couldn't be sent.` : ""),
      );
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Couldn't send");
    } finally {
      setBusy("");
    }
  };

  const dirty = JSON.stringify(rule) !== JSON.stringify(saved);

  return (
    <div className="dash-subcard">
      <p className="dash-subcard-title">How often to remind people who haven&rsquo;t paid</p>
      {rule && (
        <p className="dash-reminder-sentence">
          Remind them every
          <input aria-label="Days between reminders" type="number" min={1} max={60} value={rule.every} onChange={setNum("every")} />
          days, and stop after
          <input aria-label="Most reminders to send" type="number" min={1} max={10} value={rule.stopAfter} onChange={setNum("stopAfter")} />
          reminders.
        </p>
      )}
      {!autoSend && <p className="dash-field-hint">Reminders only go out while emails are on.</p>}
      <div className="dash-savebar dash-savebar--inline">
        <button type="button" className="dash-primary-btn focus-ring-light" onClick={save} disabled={!dirty || Boolean(busy)}>
          <Busy busy={busy === "save"}>Save</Busy>
        </button>
        <button type="button" className="dash-text-btn focus-ring-light" onClick={runNow} disabled={Boolean(busy) || !canSend}>
          <Busy busy={busy === "run"}>Send today&rsquo;s reminders now</Busy>
        </button>
        {status && <span className="dash-savebar-status">{status}</span>}
      </div>
    </div>
  );
}

type EventForm = { id: string; name: string; kind: "volunteer" | "event"; tab: string; copied: number | null; lastRun?: string; lastError?: string };

/** The event Google Forms whose responses are copied into the master sheet every morning. */
function EventFormsCard() {
  const [forms, setForms] = useState<EventForm[] | null>(null);
  const [busy, setBusy] = useState("");
  const [status, setStatus] = useState("");
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState({ name: "", kind: "event" as "volunteer" | "event", link: "" });

  useEffect(() => {
    fetch("/api/dashboard/event-forms", { cache: "no-store" })
      .then((r) => r.json() as Promise<{ forms?: EventForm[]; error?: string }>)
      .then((d) => (d.forms ? setForms(d.forms) : setStatus(d.error || "Couldn't load the event forms")))
      .catch(() => setStatus("Couldn't load the event forms"));
  }, []);

  const post = async (body: Record<string, unknown>, key: string) => {
    setBusy(key);
    setStatus("");
    try {
      const res = await fetch("/api/dashboard/event-forms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const d = (await res.json()) as {
        forms?: EventForm[];
        result?: { copied: number; skipped: number; errors: string[] };
        error?: string;
      };
      if (!res.ok || d.error) throw new Error(d.error || "Something went wrong");
      if (d.forms) setForms(d.forms);
      return d;
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Something went wrong");
      return null;
    } finally {
      setBusy("");
    }
  };

  const syncNow = async () => {
    const d = await post({ action: "sync" }, "sync");
    if (!d?.result) return;
    const { copied, errors } = d.result;
    setStatus(
      (copied === 0 ? "No new responses." : `Copied ${copied} new response${copied === 1 ? "" : "s"}.`) +
        (errors.length ? ` ${errors.join(" ")}` : ""),
    );
  };

  const add = async () => {
    const d = await post({ action: "add", ...draft }, "add");
    if (d) {
      setAdding(false);
      setDraft({ name: "", kind: "event", link: "" });
      setStatus("Form added. Responses from now on will be copied in.");
    }
  };

  return (
    <div className="dash-subcard">
      <p className="dash-subcard-title">Event Google Forms</p>
      <p className="dash-field-hint">
        New responses are copied into the master sheet every morning and get the email above. Responses from before a form was added
        aren&rsquo;t emailed.
      </p>
      {forms && forms.length > 0 && (
        <ul className="dash-email-list">
          {forms.map((f) => (
            <li key={f.id} className="dash-email-item dash-email-item--static">
              <span className="dash-email-item-text">
                <span className="dash-email-item-name">
                  {f.name} {f.kind === "volunteer" ? "volunteers" : "registrations"}
                </span>
                <span className="dash-email-item-meta">
                  {f.lastError
                    ? `Couldn't read it: ${f.lastError}`
                    : f.lastRun
                      ? `Last checked ${new Date(f.lastRun).toLocaleString("en-CA", { dateStyle: "medium", timeStyle: "short" })}`
                      : "Starts with the next check"}
                </span>
              </span>
              <button
                type="button"
                className="dash-text-btn focus-ring-light"
                onClick={() => post({ action: "remove", id: f.id }, `rm:${f.id}`)}
                disabled={Boolean(busy)}
              >
                Stop copying
              </button>
            </li>
          ))}
        </ul>
      )}

      {adding ? (
        <div className="dash-subcard-form">
          <EmailField id="ef-name" label="Event name" value={draft.name} onChange={(v) => setDraft((d) => ({ ...d, name: v }))} placeholder="Family Wellness Day 2027" />
          <div className="dash-field">
            <span className="dash-field-label">What the form is for</span>
            <Segmented
              label="What the form is for"
              value={draft.kind}
              onChange={(v) => setDraft((d) => ({ ...d, kind: v }))}
              options={[
                { value: "event", label: "Registering to attend" },
                { value: "volunteer", label: "Volunteering" },
              ]}
            />
          </div>
          <EmailField
            id="ef-link"
            label="Link to the form's response spreadsheet"
            value={draft.link}
            onChange={(v) => setDraft((d) => ({ ...d, link: v }))}
            placeholder="https://docs.google.com/spreadsheets/d/…"
            hint="In the Google Form, open Responses, then Link to Sheets. Share that sheet with africanssocietyofsc@gmail.com."
          />
          <div className="dash-savebar dash-savebar--inline">
            <button type="button" className="dash-primary-btn focus-ring-light" onClick={add} disabled={Boolean(busy) || !draft.name.trim() || !draft.link.trim()}>
              <Busy busy={busy === "add"}>Add form</Busy>
            </button>
            <button type="button" className="dash-text-btn focus-ring-light" onClick={() => setAdding(false)}>
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="dash-savebar dash-savebar--inline">
          <button type="button" className="dash-action-btn focus-ring-light" onClick={syncNow} disabled={Boolean(busy)}>
            <Busy busy={busy === "sync"}>Copy new responses now</Busy>
          </button>
          <button type="button" className="dash-text-btn focus-ring-light" onClick={() => setAdding(true)}>
            Add another form
          </button>
        </div>
      )}
      {status && <p className="dash-savebar-status">{status}</p>}
    </div>
  );
}
