"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, Plus, Search } from "lucide-react";
import { Busy, Segmented } from "@/components/dashboard/ui";
import { EmailField } from "@/components/dashboard/email-editor";
import { parseSheetDate } from "@/lib/sheet-dates";

type Receipt = {
  number: string;
  date: string;
  payerName: string;
  payerEmail: string;
  description: string;
  amount: string;
  messageId: string;
  status: string;
  sentAt: string;
  paidOn?: string;
  paidBy?: string;
  dueDate?: string;
  paid?: boolean;
  pdfUrl?: string;
};

type Filter = "all" | "unpaid" | "unsent";
type Kind = "invoice" | "receipt";
const isInvoice = (r: Receipt) => /^INV-/i.test(r.number);
const unpaid = (r: Receipt) => isInvoice(r) && !r.paid;
type ListResponse = {
  invoices?: Receipt[];
  canSend?: boolean;
  sender?: string;
  error?: string;
};

const PAID_BY = ["Interac e-Transfer", "Cash", "Card", "Cheque"] as const;

function money(value: string): string {
  const n = Number(String(value ?? "").replace(/[^0-9.]/g, ""));
  return Number.isFinite(n) ? `$${n.toFixed(2)}` : value;
}

function day(value?: string): string {
  if (!value) return "";
  const d = /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? new Date(`${value}T12:00:00`)
    : parseSheetDate(value);
  return d
    ? d.toLocaleDateString("en-CA", {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : value;
}

function today(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Every invoice and receipt ASOSC has made (searchable, PDFs kept on Cloudinary), plus writing and emailing a new one. */
export function DashboardInvoicesPanel() {
  const [data, setData] = useState<ListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [writing, setWriting] = useState<Kind | null>(null);
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState("");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");

  const fetchList = useCallback(
    () =>
      fetch("/api/dashboard/invoices", { cache: "no-store" })
        .then((r) => r.json() as Promise<ListResponse>)
        .then(setData)
        .catch(() => setData({ error: "Couldn't load invoices and receipts" }))
        .finally(() => setLoading(false)),
    [],
  );
  const load = useCallback(() => void fetchList(), [fetchList]);

  useEffect(() => {
    void fetchList();
  }, [fetchList]);

  const email = async (r: Receipt) => {
    setBusy(r.number);
    setNotice("");
    try {
      const res = await fetch("/api/dashboard/invoices/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ number: r.number }),
      });
      const d = (await res.json()) as { to?: string; error?: string };
      if (!res.ok || d.error) throw new Error(d.error || "Couldn't send");
      setNotice(
        `${isInvoice(r) ? "Invoice" : "Receipt"} ${r.number} emailed to ${d.to}.`,
      );
      load();
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Couldn't send");
    } finally {
      setBusy("");
    }
  };

  const markPaid = async (r: Receipt, paid: boolean) => {
    setBusy(`paid:${r.number}`);
    setNotice("");
    try {
      const res = await fetch("/api/dashboard/invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "paid", number: r.number, paid }),
      });
      const d = (await res.json()) as { error?: string };
      if (!res.ok || d.error) throw new Error(d.error || "Couldn't update");
      setNotice(
        paid
          ? `Invoice ${r.number} marked paid. Its PDF now shows PAID.`
          : `Invoice ${r.number} marked unpaid.`,
      );
      load();
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Couldn't update");
    } finally {
      setBusy("");
    }
  };

  const canSend = data?.canSend !== false;
  const all = data?.invoices ?? [];
  const sent = (r: Receipt) => r.status === "Sent";
  const q = query.trim().toLowerCase();
  const receipts = all.filter(
    (r) =>
      (filter === "all" || (filter === "unpaid" ? unpaid(r) : !sent(r))) &&
      (!q ||
        `${r.number} ${r.payerName} ${r.payerEmail} ${r.description} ${r.amount}`
          .toLowerCase()
          .includes(q)),
  );

  if (writing) {
    return (
      <NewReceipt
        kind={writing}
        canSend={canSend}
        sender={data?.sender ?? "support@asosc.ca"}
        onBack={() => setWriting(null)}
        onDone={(message) => {
          setWriting(null);
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
          <h2 className="dash-panel-title">Invoices &amp; receipts</h2>
          <p className="dash-panel-sub">
            Invoices ask for money still owed; receipts confirm money received.
            An invoice is marked paid when an e-Transfer quotes its number.
          </p>
          {all.length > 0 && (
            <div className="dash-panel-tabs">
              <Segmented
                label="Show"
                value={filter}
                onChange={setFilter}
                options={[
                  { value: "all", label: `All ${all.length}` },
                  {
                    value: "unpaid",
                    label: `Unpaid invoices ${all.filter(unpaid).length}`,
                  },
                  {
                    value: "unsent",
                    label: `Not emailed ${all.filter((r) => !sent(r)).length}`,
                  },
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
                placeholder="Search name, email or number…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                aria-label="Search invoices and receipts"
              />
            </div>
          )}
          <button
            type="button"
            className="dash-action-btn focus-ring-light"
            onClick={() => setWriting("receipt")}
          >
            <Plus size={16} aria-hidden />
            New receipt
          </button>
          <button
            type="button"
            className="dash-primary-btn focus-ring-light"
            onClick={() => setWriting("invoice")}
          >
            <Plus size={16} aria-hidden />
            New invoice
          </button>
        </div>
      </header>

      <div className="dash-emails-body">
        {data && !canSend && (
          <div className="dash-notice">
            <span>
              You can write invoices and receipts, but they can&rsquo;t be
              emailed until you sign in with <strong>{data.sender}</strong>.
            </span>
            <a
              className="dash-primary-btn focus-ring-light"
              href="/api/google/connect?account=support%40asosc.ca"
            >
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
            <p className="dash-empty-title">
              Invoices and receipts couldn&rsquo;t load
            </p>
            <p className="dash-empty-text">{data.error}</p>
            <button
              type="button"
              className="dash-action-btn focus-ring-light"
              onClick={load}
            >
              Try again
            </button>
          </div>
        )}
        {all.length > 0 && receipts.length === 0 && (
          <div className="dash-empty">
            <p className="dash-empty-title">Nothing matches</p>
            <p className="dash-empty-text">
              Try a different name, email or number.
            </p>
          </div>
        )}
        {data && !data.error && all.length === 0 && (
          <div className="dash-empty">
            <p className="dash-empty-title">No invoices or receipts yet</p>
            <p className="dash-empty-text">
              Invoices and receipts you write here, and receipts for payments
              you mark as &ldquo;Something else&rdquo;, show up in this list.
            </p>
            <button
              type="button"
              className="dash-primary-btn focus-ring-light"
              onClick={() => setWriting("invoice")}
            >
              Write an invoice
            </button>
          </div>
        )}

        {receipts.length > 0 && (
          <div className="dash-table-wrap">
            <table className="dash-table">
              <thead>
                <tr>
                  <th>Who</th>
                  <th>For</th>
                  <th>Amount</th>
                  <th>Paid</th>
                  <th>Emailed</th>
                  <th aria-label="Actions" />
                </tr>
              </thead>
              <tbody>
                {receipts.map((r) => (
                  <tr key={r.number}>
                    <td>
                      <span className="dash-invoice-who">
                        <strong>{r.payerName || r.payerEmail}</strong>
                        <span className="dash-cell-note">
                          {isInvoice(r) ? "Invoice" : "Receipt"} {r.number}
                          {isInvoice(r) && !r.paid
                            ? r.dueDate
                              ? `, due ${day(r.dueDate)}`
                              : ", due on receipt"
                            : `, paid ${day(r.paidOn || r.date)}`}
                        </span>
                      </span>
                    </td>
                    <td className="dash-td-memo">{r.description}</td>
                    <td>{money(r.amount)}</td>
                    <td>
                      {unpaid(r) ? (
                        <span className="dash-status-chip">Unpaid</span>
                      ) : (
                        <span className="dash-status-chip dash-status-chip--approved">
                          Paid
                        </span>
                      )}
                    </td>
                    <td>
                      {sent(r) ? (
                        <span className="dash-status-chip dash-status-chip--approved">
                          {day(r.sentAt) || "Emailed"}
                        </span>
                      ) : (
                        <span className="dash-status-chip">Not yet</span>
                      )}
                    </td>
                    <td>
                      <span className="dash-row-buttons">
                        <a
                          className="dash-action-btn dash-action-btn--small focus-ring-light"
                          href={
                            r.pdfUrl ||
                            `/api/dashboard/invoices/pdf?number=${encodeURIComponent(r.number)}`
                          }
                          target="_blank"
                          rel="noreferrer"
                        >
                          View
                        </a>
                        {isInvoice(r) && (
                          <button
                            type="button"
                            className="dash-action-btn dash-action-btn--small focus-ring-light"
                            onClick={() => markPaid(r, !r.paid)}
                            disabled={Boolean(busy)}
                          >
                            <Busy busy={busy === `paid:${r.number}`}>
                              {r.paid ? "Mark unpaid" : "Mark paid"}
                            </Busy>
                          </button>
                        )}
                        <button
                          type="button"
                          className="dash-action-btn dash-action-btn--small focus-ring-light"
                          onClick={() => email(r)}
                          disabled={Boolean(busy) || !canSend}
                        >
                          <Busy busy={busy === r.number}>
                            {sent(r) ? "Email again" : "Email it"}
                          </Busy>
                        </button>
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

type Draft = {
  name: string;
  email: string;
  description: string;
  amount: string;
  paidOn: string;
  paidBy: string;
  dueDate: string;
};

function inDays(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Writing a receipt (money received) or an invoice (money still owed), with a live PDF preview. */
function NewReceipt({
  kind,
  canSend,
  sender,
  onBack,
  onDone,
}: {
  kind: Kind;
  canSend: boolean;
  sender: string;
  onBack: () => void;
  onDone: (message: string) => void;
}) {
  const [draft, setDraft] = useState<Draft>({
    name: "",
    email: "",
    description: "",
    amount: "",
    paidOn: today(),
    paidBy: "Interac e-Transfer",
    dueDate: inDays(14),
  });
  const invoice = kind === "invoice";
  const Word = invoice ? "Invoice" : "Receipt";
  const word = invoice ? "invoice" : "receipt";
  const [pdfUrl, setPdfUrl] = useState("");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const urlRef = useRef("");
  const set = (k: keyof Draft) => (v: string) =>
    setDraft((d) => ({ ...d, [k]: v }));

  // Live PDF preview of the unsaved receipt.
  useEffect(() => {
    const timer = window.setTimeout(() => {
      fetch("/api/dashboard/invoices/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...draft, kind }),
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
  }, [draft, kind]);

  useEffect(
    () => () => {
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    },
    [],
  );

  const ready = Boolean(
    draft.email.trim() &&
    draft.description.trim() &&
    Number(draft.amount.replace(/[^0-9.]/g, "")) > 0,
  );

  const save = async (send: boolean) => {
    setBusy(send ? "send" : "save");
    setError("");
    try {
      const res = await fetch("/api/dashboard/invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: invoice ? "invoice" : "new",
          ...draft,
          send,
        }),
      });
      const d = (await res.json()) as {
        invoice?: Receipt;
        sent?: boolean;
        sendError?: string;
        error?: string;
      };
      if (!res.ok || !d.invoice) throw new Error(d.error || "Couldn't save");
      onDone(
        d.sent
          ? `${Word} ${d.invoice.number} emailed to ${d.invoice.payerEmail}.`
          : d.sendError
            ? `${Word} ${d.invoice.number} was saved but couldn't be emailed: ${d.sendError}`
            : `${Word} ${d.invoice.number} saved. Email it from the list when you're ready.`,
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
          <button
            type="button"
            className="dash-back focus-ring-light"
            onClick={onBack}
          >
            <ChevronLeft size={16} aria-hidden />
            Back
          </button>
          <h2 className="dash-panel-title">New {word}</h2>
          <p className="dash-panel-sub">
            {invoice
              ? "For money someone owes ASOSC. They get an email with the invoice attached and how to pay by e-Transfer."
              : "For money ASOSC has already received. They get an email with the receipt attached."}
          </p>
        </div>
      </header>

      <div className="dash-emails-body">
        {!canSend && (
          <div className="dash-notice">
            <span>
              You can save this {word}, but it can&rsquo;t be emailed until you
              sign in with <strong>{sender}</strong>.
            </span>
            <a
              className="dash-primary-btn focus-ring-light"
              href="/api/google/connect?account=support%40asosc.ca"
            >
              Sign in with {sender}
            </a>
          </div>
        )}
        <div className="dash-compose">
          <div className="dash-compose-form">
            <section className="dash-emails-section">
              <h3 className="dash-step-title">
                {invoice ? "Who is it for?" : "Who paid?"}
              </h3>
              <EmailField
                id="rct-name"
                label="Name or business"
                value={draft.name}
                onChange={set("name")}
              />
              <EmailField
                id="rct-email"
                label="Email address"
                value={draft.email}
                onChange={set("email")}
                placeholder="name@example.com"
              />
            </section>
            <section className="dash-emails-section">
              <h3 className="dash-step-title">
                {invoice ? "What do they owe?" : "What did they pay?"}
              </h3>
              <EmailField
                id="rct-desc"
                label="What it was for"
                value={draft.description}
                onChange={set("description")}
                multiline
                rows={3}
                placeholder="Booth rental, African Festival 2027"
              />
              <div className="dash-email-row">
                <div className="dash-field">
                  <label htmlFor="rct-amount">Amount</label>
                  <span className="dash-money-input">
                    <span aria-hidden>$</span>
                    <input
                      id="rct-amount"
                      inputMode="decimal"
                      value={draft.amount}
                      onChange={(e) => set("amount")(e.target.value)}
                      placeholder="0.00"
                    />
                  </span>
                </div>
                {invoice ? (
                  <div className="dash-field">
                    <label htmlFor="rct-due">Due date</label>
                    <input
                      id="rct-due"
                      type="date"
                      className="dash-input"
                      value={draft.dueDate}
                      onChange={(e) => set("dueDate")(e.target.value)}
                    />
                  </div>
                ) : (
                  <div className="dash-field">
                    <label htmlFor="rct-date">Date received</label>
                    <input
                      id="rct-date"
                      type="date"
                      className="dash-input"
                      value={draft.paidOn}
                      onChange={(e) => set("paidOn")(e.target.value)}
                    />
                  </div>
                )}
              </div>
              {!invoice && (
                <div className="dash-field">
                  <span className="dash-field-label">How they paid</span>
                  <Segmented
                    label="How they paid"
                    value={draft.paidBy as (typeof PAID_BY)[number]}
                    onChange={(v) => set("paidBy")(v)}
                    options={PAID_BY.map((p) => ({
                      value: p,
                      label: p === "Interac e-Transfer" ? "e-Transfer" : p,
                    }))}
                  />
                </div>
              )}
              {error && <p className="dash-error">{error}</p>}
              <div className="dash-savebar dash-savebar--inline">
                <button
                  type="button"
                  className="dash-primary-btn focus-ring-light"
                  onClick={() => save(true)}
                  disabled={!ready || Boolean(busy) || !canSend}
                >
                  <Busy busy={busy === "send"}>Email {word}</Busy>
                </button>
                <button
                  type="button"
                  className="dash-text-btn focus-ring-light"
                  onClick={() => save(false)}
                  disabled={!ready || Boolean(busy)}
                >
                  <Busy busy={busy === "save"}>Save without emailing</Busy>
                </button>
              </div>
              {!ready && (
                <p className="dash-field-hint">
                  Add an email address, what it was for, and an amount.
                </p>
              )}
            </section>
          </div>
          <aside className="dash-compose-preview">
            <div className="dash-preview-sticky">
              <p className="dash-preview-label">The {word} they&rsquo;ll get</p>
              {pdfUrl ? (
                <div className="dash-pdf-box">
                  <iframe
                    title={`${Word} preview`}
                    src={`${pdfUrl}#toolbar=0&navpanes=0&scrollbar=0&view=Fit`}
                  />
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
