"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, Plus, Search } from "lucide-react";
import { Busy, Segmented } from "@/components/dashboard/ui";
import { EmailField } from "@/components/dashboard/email-editor";
import { parseSheetDate } from "@/lib/sheet-dates";

type Invoice = {
  number: string;
  date: string;
  payerName: string;
  payerEmail: string;
  description: string;
  amount: string;
  messageId: string;
  status: string;
  sentAt: string;
  dueDate?: string;
  paidOn?: string;
  paid: boolean;
  pdfUrl?: string;
};

type Filter = "all" | "waiting" | "paid" | "draft";

function statusOf(inv: Invoice): Exclude<Filter, "all"> {
  return inv.paid ? "paid" : inv.status === "Sent" ? "waiting" : "draft";
}

type ListResponse = { invoices?: Invoice[]; canSend?: boolean; sender?: string; error?: string };

function money(value: string): string {
  const n = Number(String(value ?? "").replace(/[^0-9.]/g, ""));
  return Number.isFinite(n) ? `$${n.toFixed(2)}` : value;
}

function day(value?: string): string {
  if (!value) return "";
  const d = /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T12:00:00`) : parseSheetDate(value);
  return d ? d.toLocaleDateString("en-CA", { month: "short", day: "numeric", year: "numeric" }) : value;
}

/** Invoices sent (and their status), plus writing and emailing a new one. */
export function DashboardInvoicesPanel() {
  const [data, setData] = useState<ListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [writing, setWriting] = useState(false);
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState("");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");

  const fetchList = useCallback(
    () =>
      fetch("/api/dashboard/invoices", { cache: "no-store" })
        .then((r) => r.json() as Promise<ListResponse>)
        .then(setData)
        .catch(() => setData({ error: "Couldn't load invoices" }))
        .finally(() => setLoading(false)),
    [],
  );
  // Reload keeps the current list on screen (no blanking).
  const load = useCallback(() => void fetchList(), [fetchList]);

  useEffect(() => {
    void fetchList();
  }, [fetchList]);

  const email = async (inv: Invoice) => {
    setBusy(`send:${inv.number}`);
    setNotice("");
    try {
      const res = await fetch("/api/dashboard/invoices/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ number: inv.number }),
      });
      const d = (await res.json()) as { to?: string; error?: string };
      if (!res.ok || d.error) throw new Error(d.error || "Couldn't send");
      setNotice(`Invoice ${inv.number} emailed to ${d.to}.`);
      load();
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Couldn't send");
    } finally {
      setBusy("");
    }
  };

  const markPaid = async (inv: Invoice, paid: boolean) => {
    setBusy(`paid:${inv.number}`);
    setNotice("");
    try {
      const res = await fetch("/api/dashboard/invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "paid", number: inv.number, paid }),
      });
      const d = (await res.json()) as { error?: string };
      if (!res.ok || d.error) throw new Error(d.error || "Couldn't save");
      load();
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Couldn't save");
    } finally {
      setBusy("");
    }
  };

  const canSend = data?.canSend !== false;
  const all = data?.invoices ?? [];
  const q = query.trim().toLowerCase();
  const invoices = all.filter(
    (inv) =>
      (filter === "all" || statusOf(inv) === filter) &&
      (!q || `${inv.number} ${inv.payerName} ${inv.payerEmail} ${inv.description} ${inv.amount}`.toLowerCase().includes(q)),
  );
  const count = (f: Exclude<Filter, "all">) => all.filter((inv) => statusOf(inv) === f).length;

  if (writing) {
    return (
      <NewInvoice
        canSend={canSend}
        sender={data?.sender ?? "support@asosc.ca"}
        onBack={() => setWriting(false)}
        onDone={(message) => {
          setWriting(false);
          setNotice(message);
          load();
        }}
      />
    );
  }

  return (
    <div className="dash-panel">
      <header className="dash-panel-head">
        <div className="dash-panel-heading">
          <h2 className="dash-panel-title">Invoices</h2>
          <p className="dash-panel-sub">Every invoice and receipt ASOSC has made, with its PDF. Write a new invoice to email it.</p>
          {all.length > 0 && (
            <div className="dash-panel-tabs">
              <Segmented
                label="Show"
                value={filter}
                onChange={setFilter}
                options={[
                  { value: "all", label: `All ${all.length}` },
                  { value: "waiting", label: `Waiting for payment ${count("waiting")}` },
                  { value: "paid", label: `Paid ${count("paid")}` },
                  { value: "draft", label: `Not sent ${count("draft")}` },
                ]}
              />
            </div>
          )}
        </div>
        <div className="dash-panel-actions">
          {all.length > 0 && (
            <div className="dash-search-wrap">
              <Search size={15} aria-hidden />
              <input
                type="search"
                className="dash-search-input"
                placeholder="Search name, email or INV number…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                aria-label="Search invoices"
              />
            </div>
          )}
          <button type="button" className="dash-primary-btn focus-ring-light" onClick={() => setWriting(true)}>
            <Plus size={16} aria-hidden />
            New invoice
          </button>
        </div>
      </header>

      <div className="dash-emails-body">
        {data && !canSend && (
          <div className="dash-notice">
            <span>
              You can write invoices, but they can&rsquo;t be emailed until you sign in with <strong>{data.sender}</strong>.
            </span>
            <a className="dash-primary-btn focus-ring-light" href="/api/google/connect?account=support%40asosc.ca">
              Sign in with {data.sender}
            </a>
          </div>
        )}
        {notice && <p className="dash-notice dash-notice--plain">{notice}</p>}

        {loading && !data && (
          <div className="dash-empty">
            <p className="dash-muted">Loading…</p>
          </div>
        )}
        {data?.error && (
          <div className="dash-empty">
            <p className="dash-empty-title">Invoices couldn&rsquo;t load</p>
            <p className="dash-empty-text">{data.error}</p>
            <button type="button" className="dash-action-btn focus-ring-light" onClick={load}>
              Try again
            </button>
          </div>
        )}
        {all.length > 0 && invoices.length === 0 && (
          <div className="dash-empty">
            <p className="dash-empty-title">No invoices match</p>
            <p className="dash-empty-text">Try a different name, email or invoice number.</p>
          </div>
        )}
        {data && !data.error && all.length === 0 && (
          <div className="dash-empty">
            <p className="dash-empty-title">No invoices yet</p>
            <p className="dash-empty-text">
              Invoices you write here, and receipts for payments you mark as &ldquo;Something else&rdquo;, show up in this list.
            </p>
            <button type="button" className="dash-primary-btn focus-ring-light" onClick={() => setWriting(true)}>
              Write an invoice
            </button>
          </div>
        )}

        {invoices.length > 0 && (
          <div className="dash-table-wrap">
            <table className="dash-table">
              <thead>
                <tr>
                  <th>Who</th>
                  <th>For</th>
                  <th>Amount</th>
                  <th>Status</th>
                  <th aria-label="Actions" />
                </tr>
              </thead>
              <tbody>
                {invoices.map((inv) => (
                  <tr key={inv.number}>
                    <td>
                      <span className="dash-invoice-who">
                        <strong>{inv.payerName || inv.payerEmail}</strong>
                        <span className="dash-cell-note">
                          {inv.messageId ? "Receipt" : "Invoice"} {inv.number}, {day(inv.date)}
                        </span>
                      </span>
                    </td>
                    <td className="dash-td-memo">{inv.description}</td>
                    <td>{money(inv.amount)}</td>
                    <td>
                      {inv.paid ? (
                        <span className="dash-status-cell">
                          <span className="dash-status-chip dash-status-chip--approved">Paid</span>
                          {inv.paidOn && <span className="dash-cell-note">{day(inv.paidOn)}</span>}
                        </span>
                      ) : inv.status === "Sent" ? (
                        <span className="dash-status-cell">
                          <span className="dash-status-chip dash-status-chip--waiting">Waiting for payment</span>
                          <span className="dash-cell-note">{inv.dueDate ? `Due ${day(inv.dueDate)}` : `Sent ${day(inv.sentAt)}`}</span>
                        </span>
                      ) : (
                        <span className="dash-status-chip">Not sent yet</span>
                      )}
                    </td>
                    <td>
                      <span className="dash-row-buttons">
                        <a
                          className="dash-action-btn dash-action-btn--small focus-ring-light"
                          href={inv.pdfUrl || `/api/dashboard/invoices/pdf?number=${encodeURIComponent(inv.number)}`}
                          target="_blank"
                          rel="noreferrer"
                        >
                          View
                        </a>
                        <button
                          type="button"
                          className="dash-action-btn dash-action-btn--small focus-ring-light"
                          onClick={() => email(inv)}
                          disabled={Boolean(busy) || !canSend}
                        >
                          <Busy busy={busy === `send:${inv.number}`}>{inv.status === "Sent" ? "Email again" : "Email it"}</Busy>
                        </button>
                        {!inv.paid && (
                          <button
                            type="button"
                            className="dash-action-btn dash-action-btn--small focus-ring-light"
                            onClick={() => markPaid(inv, true)}
                            disabled={Boolean(busy)}
                          >
                            <Busy busy={busy === `paid:${inv.number}`}>Mark paid</Busy>
                          </button>
                        )}
                        {inv.paid && !inv.messageId && (
                          <button
                            type="button"
                            className="dash-text-btn focus-ring-light"
                            onClick={() => markPaid(inv, false)}
                            disabled={Boolean(busy)}
                          >
                            Not paid
                          </button>
                        )}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

type Draft = { name: string; email: string; description: string; amount: string; dueDate: string };

function NewInvoice({
  canSend,
  sender,
  onBack,
  onDone,
}: {
  canSend: boolean;
  sender: string;
  onBack: () => void;
  onDone: (message: string) => void;
}) {
  const [draft, setDraft] = useState<Draft>({ name: "", email: "", description: "", amount: "", dueDate: "" });
  const [pdfUrl, setPdfUrl] = useState("");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const urlRef = useRef("");
  const set = (k: keyof Draft) => (v: string) => setDraft((d) => ({ ...d, [k]: v }));

  // Live PDF preview of the unsaved invoice.
  useEffect(() => {
    const timer = window.setTimeout(() => {
      fetch("/api/dashboard/invoices/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      })
        .then((r) => (r.ok ? r.blob() : null))
        .then((blob) => {
          if (!blob) return;
          const url = URL.createObjectURL(blob);
          if (urlRef.current) URL.revokeObjectURL(urlRef.current);
          urlRef.current = url;
          setPdfUrl(url);
        })
        .catch(() => undefined);
    }, 500);
    return () => window.clearTimeout(timer);
  }, [draft]);

  useEffect(() => () => {
    if (urlRef.current) URL.revokeObjectURL(urlRef.current);
  }, []);

  const ready = Boolean(draft.email.trim() && draft.description.trim() && Number(draft.amount.replace(/[^0-9.]/g, "")) > 0);

  const save = async (send: boolean) => {
    setBusy(send ? "send" : "save");
    setError("");
    try {
      const res = await fetch("/api/dashboard/invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "new", ...draft, send }),
      });
      const d = (await res.json()) as { invoice?: Invoice; sent?: boolean; sendError?: string; error?: string };
      if (!res.ok || !d.invoice) throw new Error(d.error || "Couldn't save");
      onDone(
        d.sent
          ? `Invoice ${d.invoice.number} emailed to ${d.invoice.payerEmail}.`
          : d.sendError
            ? `Invoice ${d.invoice.number} was saved but couldn't be emailed: ${d.sendError}`
            : `Invoice ${d.invoice.number} saved. Email it from the list when you're ready.`,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save");
      setBusy("");
    }
  };

  return (
    <div className="dash-panel">
      <header className="dash-panel-head">
        <div className="dash-panel-heading">
          <button type="button" className="dash-back focus-ring-light" onClick={onBack}>
            <ChevronLeft size={16} aria-hidden />
            Back
          </button>
          <h2 className="dash-panel-title">New invoice</h2>
          <p className="dash-panel-sub">They get an email with the invoice attached and how to pay by e-Transfer.</p>
        </div>
      </header>

      <div className="dash-emails-body">
        {!canSend && (
          <div className="dash-notice">
            <span>
              You can save this invoice, but it can&rsquo;t be emailed until you sign in with <strong>{sender}</strong>.
            </span>
            <a className="dash-primary-btn focus-ring-light" href="/api/google/connect?account=support%40asosc.ca">
              Sign in with {sender}
            </a>
          </div>
        )}
        <div className="dash-compose">
          <div className="dash-compose-form">
            <section className="dash-emails-section">
              <h3 className="dash-step-title">Who is it for?</h3>
              <EmailField id="inv-name" label="Name or business" value={draft.name} onChange={set("name")} />
              <EmailField id="inv-email" label="Email address" value={draft.email} onChange={set("email")} placeholder="name@example.com" />
            </section>
            <section className="dash-emails-section">
              <h3 className="dash-step-title">What is it for?</h3>
              <EmailField
                id="inv-desc"
                label="Description"
                value={draft.description}
                onChange={set("description")}
                multiline
                rows={3}
                placeholder="Booth rental, African Festival 2027"
              />
              <div className="dash-email-row">
                <div className="dash-field">
                  <label htmlFor="inv-amount">Amount</label>
                  <span className="dash-money-input">
                    <span aria-hidden>$</span>
                    <input
                      id="inv-amount"
                      inputMode="decimal"
                      value={draft.amount}
                      onChange={(e) => set("amount")(e.target.value)}
                      placeholder="0.00"
                    />
                  </span>
                </div>
                <div className="dash-field">
                  <label htmlFor="inv-due">Pay by (optional)</label>
                  <input id="inv-due" type="date" className="dash-input" value={draft.dueDate} onChange={(e) => set("dueDate")(e.target.value)} />
                </div>
              </div>
              {error && <p className="dash-error">{error}</p>}
              <div className="dash-savebar dash-savebar--inline">
                <button type="button" className="dash-primary-btn focus-ring-light" onClick={() => save(true)} disabled={!ready || Boolean(busy) || !canSend}>
                  <Busy busy={busy === "send"}>Email invoice</Busy>
                </button>
                <button type="button" className="dash-text-btn focus-ring-light" onClick={() => save(false)} disabled={!ready || Boolean(busy)}>
                  <Busy busy={busy === "save"}>Save without emailing</Busy>
                </button>
              </div>
              {!ready && <p className="dash-field-hint">Add an email address, a description and an amount.</p>}
            </section>
          </div>
          <aside className="dash-compose-preview">
            <div className="dash-preview-sticky">
              <p className="dash-preview-label">The invoice they&rsquo;ll get</p>
              {pdfUrl ? (
                <div className="dash-pdf-box">
                  <iframe title="Invoice preview" src={`${pdfUrl}#toolbar=0&navpanes=0&scrollbar=0&view=Fit`} />
                </div>
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
