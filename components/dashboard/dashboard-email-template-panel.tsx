"use client";

import { useEffect, useMemo, useState } from "react";
import { RefreshCw, Save } from "lucide-react";
import {
  MEMBERSHIP_EMAIL_PREVIEW_SAMPLES,
  defaultMembershipEmailTemplate,
  renderMembershipEmailBody,
  type MembershipEmailTemplate,
} from "@/lib/membership-email-render";
import { buildBrandedEmail } from "@/lib/membership-email-brand";
import {
  FLOW_META,
  FLOW_PREVIEW_SAMPLE,
  defaultFlowEmailTemplate,
  renderFlowEmailBody,
  type EmailFlowId,
  type FlowEmailTemplate,
} from "@/lib/flow-email-render";

const MEMBERSHIP_PREVIEW_SAMPLE = MEMBERSHIP_EMAIL_PREVIEW_SAMPLES[0];

type PanelId = "membership" | EmailFlowId;

const PANELS: Array<{ id: PanelId; title: string }> = [
  { id: "membership", title: "Membership" },
  ...(Object.keys(FLOW_META) as EmailFlowId[]).map((id) => ({ id, title: FLOW_META[id].title })),
];

export function DashboardEmailTemplatePanel() {
  const [active, setActive] = useState<PanelId>("membership");

  return (
    <div className="dash-panel">
      <div className="dash-email-flow-tabs" role="tablist" aria-label="Email template">
        {PANELS.map((p) => (
          <button
            key={p.id}
            type="button"
            role="tab"
            aria-selected={active === p.id}
            className={`dash-email-flow-tab focus-ring-light${active === p.id ? " dash-email-flow-tab--active" : ""}`}
            onClick={() => setActive(p.id)}
          >
            {p.title}
          </button>
        ))}
      </div>

      {active === "membership" ? <MembershipEmailEditor /> : <FlowEmailEditor flow={active} />}
    </div>
  );
}

type MembershipTemplateResponse = { template?: MembershipEmailTemplate; error?: string };

function MembershipEmailEditor() {
  const [template, setTemplate] = useState<MembershipEmailTemplate | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [saved, setSaved] = useState(false);

  const load = () => {
    setLoading(true);
    setLoadError("");
    fetch("/api/dashboard/email-template/membership", { cache: "no-store" })
      .then((res) => res.json() as Promise<MembershipTemplateResponse>)
      .then((data) => {
        if (data.error) setLoadError(data.error);
        else setTemplate(data.template ?? defaultMembershipEmailTemplate());
      })
      .catch(() => setLoadError("Failed to load the email template."))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- load is a stable fetch-once helper
  }, []);

  const update = (patch: Partial<MembershipEmailTemplate>) => {
    setTemplate((prev) => (prev ? { ...prev, ...patch } : prev));
    setSaved(false);
  };

  const save = async () => {
    if (!template) return;
    setSaving(true);
    setSaveError("");
    try {
      const res = await fetch("/api/dashboard/email-template/membership", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ template }),
      });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || "Failed to save");
      setSaved(true);
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const previewHtml = useMemo(() => {
    if (!template) return "";
    const body = renderMembershipEmailBody(template, MEMBERSHIP_PREVIEW_SAMPLE);
    return buildBrandedEmail(body, {
      buttonLabel: template.buttonLabel,
      buttonUrl: template.buttonUrl,
      preheader: template.preheader,
    });
  }, [template]);

  return (
    <>
      <header className="dash-panel-head">
        <div className="dash-panel-heading">
          <h2 className="dash-panel-title">Follow-up Email</h2>
          <p className="dash-panel-sub">
            Sent automatically by Membershipfollowup.gs after a member signs up. Stored in the{" "}
            <span className="dash-mono">Membership Email</span> tab.
          </p>
        </div>
        <div className="dash-panel-actions">
          <button
            type="button"
            className="dash-action-btn focus-ring-light"
            onClick={load}
            disabled={loading}
            title="Reload from the sheet"
          >
            <RefreshCw size={16} className={loading ? "dash-spin" : undefined} />
            Reload
          </button>
          <button
            type="button"
            className="dash-primary-btn focus-ring-light"
            style={{ display: "flex", alignItems: "center", gap: "0.375rem" }}
            onClick={save}
            disabled={saving || !template}
          >
            <Save size={16} />
            {saving ? "Saving…" : saved ? "Saved" : "Save"}
          </button>
        </div>
      </header>

      {loading && (
        <div className="dash-empty">
          <p className="dash-muted">Loading…</p>
        </div>
      )}

      {!loading && loadError && (
        <div className="dash-empty">
          <p>Couldn&rsquo;t load the membership email template.</p>
          <p className="dash-muted">{loadError}</p>
        </div>
      )}

      {!loading && !loadError && template && (
        <div className="dash-email-editor">
          <div className="dash-email-col">
            {saveError && <p className="dash-error">{saveError}</p>}

            <label className="dash-field">
              Subject
              <input value={template.subject} onChange={(e) => update({ subject: e.target.value })} />
            </label>

            <label className="dash-field">
              Body
              <textarea
                className="dash-email-textarea"
                rows={12}
                value={template.body}
                onChange={(e) => update({ body: e.target.value })}
              />
            </label>

            <label className="dash-field">
              Payment confirmation
              <textarea
                className="dash-email-textarea"
                rows={4}
                value={template.paymentBlock}
                onChange={(e) => update({ paymentBlock: e.target.value })}
              />
            </label>

            <div className="dash-email-row">
              <label className="dash-field">
                Button label
                <input value={template.buttonLabel} onChange={(e) => update({ buttonLabel: e.target.value })} />
              </label>
              <label className="dash-field">
                Button URL
                <input value={template.buttonUrl} onChange={(e) => update({ buttonUrl: e.target.value })} />
              </label>
            </div>

            <label className="dash-field">
              Preheader (inbox preview text, optional)
              <input value={template.preheader} onChange={(e) => update({ preheader: e.target.value })} />
            </label>

            <p className="dash-muted dash-email-hint">
              Placeholders: {"{{first_name}}"} {"{{name}}"} {"{{category}}"} {"{{amount}}"}{" "}
              {"{{payment_instructions}}"} {"{{payment_method}}"} {"{{email}}"}
            </p>
          </div>

          <div className="dash-email-col dash-email-col--preview">
            <div className="dash-email-preview">
              <iframe title="Email preview" className="dash-email-preview-frame" srcDoc={previewHtml} />
            </div>
          </div>
        </div>
      )}
    </>
  );
}

type FlowTemplateResponse = { template?: FlowEmailTemplate; error?: string };

function FlowEmailEditor({ flow }: { flow: EmailFlowId }) {
  const meta = FLOW_META[flow];
  const [template, setTemplate] = useState<FlowEmailTemplate | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [saved, setSaved] = useState(false);

  const load = () => {
    setLoading(true);
    setLoadError("");
    fetch(`/api/dashboard/email-template/flow/${flow}`, { cache: "no-store" })
      .then((res) => res.json() as Promise<FlowTemplateResponse>)
      .then((data) => {
        if (data.error) setLoadError(data.error);
        else setTemplate(data.template ?? defaultFlowEmailTemplate(flow));
      })
      .catch(() => setLoadError("Failed to load the email template."))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    setTemplate(null);
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reload whenever the selected flow changes
  }, [flow]);

  const update = (patch: Partial<FlowEmailTemplate>) => {
    setTemplate((prev) => (prev ? { ...prev, ...patch } : prev));
    setSaved(false);
  };

  const save = async () => {
    if (!template) return;
    setSaving(true);
    setSaveError("");
    try {
      const res = await fetch(`/api/dashboard/email-template/flow/${flow}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ template }),
      });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || "Failed to save");
      setSaved(true);
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const previewHtml = useMemo(() => {
    if (!template) return "";
    const body = renderFlowEmailBody(flow, template, FLOW_PREVIEW_SAMPLE[flow]);
    return buildBrandedEmail(body, {
      buttonLabel: template.buttonLabel,
      buttonUrl: template.buttonUrl,
      preheader: template.preheader,
      unsubscribe: meta.hasUnsubscribe ? template.unsubscribe : undefined,
    });
  }, [flow, meta.hasUnsubscribe, template]);

  return (
    <>
      <header className="dash-panel-head">
        <div className="dash-panel-heading">
          <h2 className="dash-panel-title">{meta.title} follow-up email</h2>
          <p className="dash-panel-sub">
            Stored in the <span className="dash-mono">{meta.sheetTab}</span> tab.
          </p>
        </div>
        <div className="dash-panel-actions">
          <button
            type="button"
            className="dash-action-btn focus-ring-light"
            onClick={load}
            disabled={loading}
            title="Reload from the sheet"
          >
            <RefreshCw size={16} className={loading ? "dash-spin" : undefined} />
            Reload
          </button>
          <button
            type="button"
            className="dash-primary-btn focus-ring-light"
            style={{ display: "flex", alignItems: "center", gap: "0.375rem" }}
            onClick={save}
            disabled={saving || !template}
          >
            <Save size={16} />
            {saving ? "Saving…" : saved ? "Saved" : "Save"}
          </button>
        </div>
      </header>

      {loading && (
        <div className="dash-empty">
          <p className="dash-muted">Loading…</p>
        </div>
      )}

      {!loading && loadError && (
        <div className="dash-empty">
          <p>Couldn&rsquo;t load the {meta.title} email template.</p>
          <p className="dash-muted">{loadError}</p>
          {/is not configured/i.test(loadError) && (
            <p className="dash-muted">
              Set the missing spreadsheet id on Vercel (Production), redeploy, then reload.
            </p>
          )}
        </div>
      )}

      {!loading && !loadError && template && (
        <div className="dash-email-editor">
          <div className="dash-email-col">
            {saveError && <p className="dash-error">{saveError}</p>}

            <label className="dash-field">
              Subject
              <input value={template.subject} onChange={(e) => update({ subject: e.target.value })} />
            </label>

            <label className="dash-field">
              Body
              <textarea
                className="dash-email-textarea"
                rows={12}
                value={template.body}
                onChange={(e) => update({ body: e.target.value })}
              />
            </label>

            {meta.hasPaymentBlocks && (
              <>
                <label className="dash-field">
                  E-transfer instructions
                  <textarea
                    className="dash-email-textarea"
                    rows={6}
                    value={template.etransferBlock ?? ""}
                    onChange={(e) => update({ etransferBlock: e.target.value })}
                  />
                </label>
                <label className="dash-field">
                  Card instructions
                  <textarea
                    className="dash-email-textarea"
                    rows={4}
                    value={template.cardBlock ?? ""}
                    onChange={(e) => update({ cardBlock: e.target.value })}
                  />
                </label>
              </>
            )}

            <div className="dash-email-row">
              <label className="dash-field">
                Button label
                <input value={template.buttonLabel} onChange={(e) => update({ buttonLabel: e.target.value })} />
              </label>
              <label className="dash-field">
                Button URL
                <input value={template.buttonUrl} onChange={(e) => update({ buttonUrl: e.target.value })} />
              </label>
            </div>

            <label className="dash-field">
              Preheader (inbox preview text, optional)
              <input value={template.preheader} onChange={(e) => update({ preheader: e.target.value })} />
            </label>

            {meta.hasUnsubscribe && (
              <label className="dash-field">
                Unsubscribe link (optional — falls back to a mailto if blank)
                <input value={template.unsubscribe ?? ""} onChange={(e) => update({ unsubscribe: e.target.value })} />
              </label>
            )}

            <p className="dash-muted dash-email-hint">Placeholders: {meta.placeholders.join(" ")}</p>
          </div>

          <div className="dash-email-col dash-email-col--preview">
            <div className="dash-email-preview">
              <iframe title="Email preview" className="dash-email-preview-frame" srcDoc={previewHtml} />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
