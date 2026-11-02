"use client";

import { useCallback, useEffect, useState } from "react";
import { RefreshCw, RotateCcw, Save, Send } from "lucide-react";
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
  return parsed ? parsed.toLocaleString("en-CA", { dateStyle: "medium", timeStyle: "short" }) : value || "—";
}

/** Sending status, template previews, and signups still waiting for their confirmation email. */
export function DashboardEmailsPanel() {
  const [data, setData] = useState<EmailsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [previewId, setPreviewId] = useState("membership");
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
          ? "Automatic emails are on. New signups and matched payments will be emailed."
          : "Automatic emails are off. Nothing goes out unless you press Send.",
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

  const template = data?.templates?.find((t) => t.id === previewId) ?? data?.templates?.[0];
  const pending = data?.pending ?? [];

  return (
    <div className="dash-panel">
      <header className="dash-panel-head">
        <div className="dash-panel-heading">
          <h2 className="dash-panel-title">Emails</h2>
          {data && (
            <p className="dash-panel-sub">
              Sent from {data.sender}. Automatic emails are <strong>{data.autoSend ? "on" : "off"}</strong>
              {data.autoSend
                ? ": new signups and matched payments are emailed straight away."
                : ": nothing goes out unless you press Send."}
            </p>
          )}
        </div>
        <div className="dash-panel-actions">
          {data && (
            <button
              type="button"
              role="switch"
              aria-checked={Boolean(data.autoSend)}
              className={data.autoSend ? "dash-action-btn focus-ring-light" : "dash-primary-btn focus-ring-light"}
              onClick={toggleAutoSend}
              disabled={toggling || (!data.autoSend && !data.canSend)}
              title={!data.canSend ? `Connect ${data.sender} first` : undefined}
            >
              {toggling ? "Saving…" : data.autoSend ? "Turn automatic emails off" : "Turn automatic emails on"}
            </button>
          )}
          <button type="button" className="dash-action-btn focus-ring-light" onClick={load} disabled={loading}>
            <RefreshCw size={16} className={loading ? "dash-spin" : undefined} />
            Refresh
          </button>
        </div>
      </header>

      {error && (
        <div className="dash-empty">
          <p>Couldn&rsquo;t load emails.</p>
          <p className="dash-muted">{error}</p>
        </div>
      )}

      {data && !data.canSend && (
        <div className="dash-empty">
          <p>{data.sender} can&rsquo;t send email yet.</p>
          <p className="dash-muted">
            Connect it once, signed in as {data.sender}, and allow &ldquo;Send email on your behalf&rdquo;.
          </p>
          <p className="dash-muted">
            <a className="dash-action-btn focus-ring-light inline-flex" href="/api/google/connect">
              Connect {data.sender}
            </a>
          </p>
        </div>
      )}

      {notice && <p className="dash-interac-summary dash-muted">{notice}</p>}

      {data && (
        <>
          <h3 className="dash-panel-sub" style={{ padding: "0.875rem 1.25rem 0", fontWeight: 600 }}>
            Waiting for a confirmation ({pending.length})
          </h3>
          {pending.length === 0 ? (
            <div className="dash-empty">
              <p className="dash-muted">Everyone who signed up has been emailed.</p>
            </div>
          ) : (
            <div className="dash-table-wrap">
              <table className="dash-table">
                <thead>
                  <tr>
                    <th>Signed up</th>
                    <th>List</th>
                    <th>Name</th>
                    <th>Email</th>
                    <th aria-label="Actions" />
                  </tr>
                </thead>
                <tbody>
                  {pending.map((p) => {
                    const key = `${p.tab}:${p.rowNumber}`;
                    return (
                      <tr key={key}>
                        <td>{formatTime(p.timestamp)}</td>
                        <td>{p.tab === "Master List" ? "Membership" : p.tab}</td>
                        <td>{p.name || "—"}</td>
                        <td>{p.email}</td>
                        <td className="dash-row-actions">
                          <button
                            type="button"
                            className="dash-action-btn focus-ring-light"
                            onClick={() => send(p)}
                            disabled={!data.canSend || Boolean(sending)}
                          >
                            <Send size={15} />
                            {sending === key ? "Sending…" : "Send"}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          <RemindersCard autoSend={Boolean(data.autoSend)} canSend={Boolean(data.canSend)} />

          <h3 className="dash-panel-sub" style={{ padding: "1.25rem 1.25rem 0", fontWeight: 600 }}>
            Automatic emails
          </h3>
          <div className="dash-email-flow-tabs" role="tablist" aria-label="Automatic emails">
            {(data.templates ?? []).map((t) => (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={template?.id === t.id}
                className={`dash-email-flow-tab focus-ring-light${template?.id === t.id ? " dash-email-flow-tab--active" : ""}`}
                onClick={() => setPreviewId(t.id)}
              >
                {t.label}
                {t.edited ? " •" : ""}
              </button>
            ))}
          </div>
          {template && (
            <AutoEmailEditor
              key={template.id}
              template={template}
              onSaved={(copy, edited) =>
                setData((prev) =>
                  prev
                    ? { ...prev, templates: prev.templates?.map((t) => (t.id === template.id ? { ...t, copy, edited } : t)) }
                    : prev,
                )
              }
            />
          )}
        </>
      )}
    </div>
  );
}

/** Edit one automatic email's wording and photo, with a live preview. The payment/receipt boxes stay automatic. */
function AutoEmailEditor({ template, onSaved }: { template: Template; onSaved: (copy: Copy, edited: boolean) => void }) {
  const [copy, setCopy] = useState<Copy>(template.copy);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState("");
  const set = (k: keyof Copy) => (v: string) => setCopy((c) => ({ ...c, [k]: v }));
  const preview = useEmailPreview({ kind: "auto", id: template.id, copy }, [template.id, JSON.stringify(copy)]);
  const dirty = JSON.stringify(copy) !== JSON.stringify(template.copy);
  const f = (k: keyof Copy) => `email-${template.id}-${k}`;

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
      setStatus("Saved. New emails will use this wording.");
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
      setStatus("Back to the original wording.");
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Couldn't reset");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="dash-email-editor" style={{ padding: "0.875rem 1.25rem 1.25rem" }}>
      <div className="dash-email-col">
        <p className="dash-muted dash-email-hint">
          Sent {template.when.charAt(0).toLowerCase() + template.when.slice(1)} You can use{" "}
          {template.placeholders.map((p, i) => (
            <span key={p}>
              <code className="dash-mono">{`{${p}}`}</code>
              {i < template.placeholders.length - 1 ? ", " : ""}
            </span>
          ))}
          . Leave a blank line between paragraphs.
        </p>
        <EmailField id={f("subject")} label="Subject" value={copy.subject} onChange={set("subject")} />
        <EmailField id={f("preheader")} label="Inbox preview text" value={copy.preheader} onChange={set("preheader")} hint="Shown after the subject in most inboxes." />
        <div className="dash-email-row">
          <EmailField id={f("banner")} label="Top strip" value={copy.banner} onChange={set("banner")} />
          <EmailField id={f("headline")} label="Headline" value={copy.headline} onChange={set("headline")} />
        </div>
        <EmailField id={f("subhead")} label="Subheading" value={copy.subhead} onChange={set("subhead")} />
        <EventImageField id={f("heroUrl")} value={copy.heroUrl ?? ""} onChange={set("heroUrl")} emptyLabel="Using the default photo" />
        <EmailField id={f("intro")} label="Message (above the box)" value={copy.intro} onChange={set("intro")} multiline rows={6} />
        <EmailField id={f("outro")} label="Message (below the box)" value={copy.outro} onChange={set("outro")} multiline rows={5} />
        <div className="dash-email-row" style={{ alignItems: "center", flexWrap: "wrap" }}>
          <button type="button" className="dash-primary-btn focus-ring-light" onClick={save} disabled={saving || !dirty}>
            <Save size={15} />
            {saving ? "Saving…" : "Save wording"}
          </button>
          <button type="button" className="dash-action-btn focus-ring-light" onClick={reset} disabled={saving || !template.edited}>
            <RotateCcw size={15} />
            Reset to original
          </button>
          {status && <span className="dash-muted">{status}</span>}
        </div>
      </div>
      <div className="dash-email-col dash-email-col--preview">
        <p className="dash-muted" style={{ margin: 0 }}>
          Subject: <strong>{preview.subject || template.subject}</strong>
        </p>
        <EmailPreviewFrame html={preview.html || template.html} title={`${template.label} preview`} />
      </div>
    </div>
  );
}

type Schedule = { daysBetween: number; perRound: number; pauseDays: number; rounds: number };

/** Reminder timing (stored in the master sheet's Settings tab) and a manual run. */
function RemindersCard({ autoSend, canSend }: { autoSend: boolean; canSend: boolean }) {
  const [schedule, setSchedule] = useState<Schedule | null>(null);
  const [saved, setSaved] = useState<Schedule | null>(null);
  const [busy, setBusy] = useState("");
  const [status, setStatus] = useState("");

  useEffect(() => {
    fetch("/api/dashboard/reminders", { cache: "no-store" })
      .then((r) => r.json() as Promise<{ schedule?: Schedule }>)
      .then((d) => {
        if (d.schedule) {
          setSchedule(d.schedule);
          setSaved(d.schedule);
        }
      })
      .catch(() => setStatus("Couldn't load the reminder schedule."));
  }, []);

  const setNum = (k: keyof Schedule) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setSchedule((s) => (s ? { ...s, [k]: Number(e.target.value) } : s));

  const save = async () => {
    if (!schedule) return;
    setBusy("save");
    setStatus("");
    try {
      const res = await fetch("/api/dashboard/reminders", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(schedule),
      });
      const d = (await res.json()) as { schedule?: Schedule; error?: string };
      if (!res.ok || !d.schedule) throw new Error(d.error || "Couldn't save");
      setSchedule(d.schedule);
      setSaved(d.schedule);
      setStatus("Schedule saved.");
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
      const d = (await res.json()) as {
        approvals?: number;
        reminders?: Record<string, number>;
        errors?: string[];
        error?: string;
      };
      if (!res.ok || d.error) throw new Error(d.error || "Run failed");
      const r = d.reminders ?? {};
      const total = (r.membership ?? 0) + (r.donation ?? 0) + (r.vendor ?? 0);
      setStatus(
        `Sent ${d.approvals ?? 0} vendor approval${d.approvals === 1 ? "" : "s"} and ${total} reminder${total === 1 ? "" : "s"} ` +
          `(${r.membership ?? 0} membership, ${r.donation ?? 0} donation, ${r.vendor ?? 0} vendor).` +
          (d.errors?.length ? ` ${d.errors.length} failed: ${d.errors.slice(0, 3).join("; ")}` : ""),
      );
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Run failed");
    } finally {
      setBusy("");
    }
  };

  const dirty = JSON.stringify(schedule) !== JSON.stringify(saved);
  const total = schedule ? schedule.perRound * schedule.rounds : 0;

  return (
    <section className="dash-reminders" aria-labelledby="reminders-title">
      <h3 id="reminders-title" className="dash-panel-sub" style={{ fontWeight: 600, margin: 0 }}>
        Payment reminders
      </h3>
      <p className="dash-muted dash-email-hint">
        For unpaid memberships, donations, and approved vendors with a fee. Vendors are approved by setting their Status to
        Approved in Vendors, which sends the approval email on the next run. Runs every morning while automatic emails are{" "}
        {autoSend ? "on (they are)" : "on (they're off right now)"}.
      </p>
      {schedule && (
        <div className="dash-reminder-grid">
          <label className="dash-field" htmlFor="rem-days">
            <span>Days between reminders</span>
            <input id="rem-days" type="number" min={1} max={60} value={schedule.daysBetween} onChange={setNum("daysBetween")} />
          </label>
          <label className="dash-field" htmlFor="rem-per">
            <span>Reminders per round</span>
            <input id="rem-per" type="number" min={1} max={10} value={schedule.perRound} onChange={setNum("perRound")} />
          </label>
          <label className="dash-field" htmlFor="rem-pause">
            <span>Pause between rounds (days)</span>
            <input id="rem-pause" type="number" min={1} max={365} value={schedule.pauseDays} onChange={setNum("pauseDays")} />
          </label>
          <label className="dash-field" htmlFor="rem-rounds">
            <span>Rounds</span>
            <input id="rem-rounds" type="number" min={1} max={12} value={schedule.rounds} onChange={setNum("rounds")} />
          </label>
        </div>
      )}
      {schedule && (
        <p className="dash-muted dash-email-hint">
          Someone who never pays gets at most {total} reminder{total === 1 ? "" : "s"}: {schedule.perRound} every{" "}
          {schedule.daysBetween} day{schedule.daysBetween === 1 ? "" : "s"}, then a {schedule.pauseDays}-day pause, up to{" "}
          {schedule.rounds} round{schedule.rounds === 1 ? "" : "s"}. Ticking &ldquo;Stop Reminders&rdquo; on a row stops them for that person.
        </p>
      )}
      <div className="dash-email-row" style={{ alignItems: "center", flexWrap: "wrap" }}>
        <button type="button" className="dash-primary-btn focus-ring-light" onClick={save} disabled={!dirty || Boolean(busy)}>
          {busy === "save" ? "Saving…" : "Save schedule"}
        </button>
        <button
          type="button"
          className="dash-action-btn focus-ring-light"
          onClick={runNow}
          disabled={Boolean(busy) || !canSend}
          title={!canSend ? "Connect support@asosc.ca first" : "Send any reminders and vendor approvals that are due now"}
        >
          {busy === "run" ? "Running…" : "Run reminders now"}
        </button>
        {status && <span className="dash-muted">{status}</span>}
      </div>
    </section>
  );
}
