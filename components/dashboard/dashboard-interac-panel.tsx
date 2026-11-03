"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Download, FileText, Inbox, RefreshCw, Search, Send } from "lucide-react";
import { Segmented, Busy } from "@/components/dashboard/ui";
import { parseSheetDate } from "@/lib/sheet-dates";

/** Mirrors PAYMENT_TYPES in lib/payments.ts (kept local so this client file doesn't import server code). */
const PAYMENT_TYPES = ["Membership", "Donation", "Vendor", "Service", "Blocked"] as const;

type PaymentsResponse = {
  headers?: string[];
  rows?: string[][];
  spreadsheetId?: string;
  result?: { checked: number; logged: number; byType: Record<string, number>; errors: string[] };
  error?: string;
};

const LOG_COLUMNS: Array<{ header: string; label: string }> = [
  { header: "Received", label: "Received" },
  { header: "Payer Name", label: "Name" },
  { header: "Payer Email", label: "From" },
  { header: "Amount", label: "Amount" },
  { header: "Memo", label: "Memo" },
  { header: "Matched To", label: "Signed up as" },
];

type ExpenseView = "debit" | "invoice" | "receipt";
type PaymentsView = "transfers" | ExpenseView;

/** What each payment type is called in the dropdown. */
const TYPE_LABEL: Record<string, string> = {
  Membership: "Membership",
  Donation: "Donation",
  Vendor: "Vendor fee",
  Service: "Something else",
  Blocked: "Fake notice (ignore)",
};

type LinkKind = "Membership" | "Donation" | "Vendor";
const isLinkKind = (t: string): t is LinkKind => t === "Membership" || t === "Donation" || t === "Vendor";

/** Bank notices write names in capitals ("OLUBUSAYO DISU"); show them as "Olubusayo Disu". */
function tidyName(value: string): string {
  if (!value || value !== value.toUpperCase() || !/[A-Z]/.test(value)) return value;
  const small = new Set(["of", "and", "the", "for", "de"]);
  return value
    .split(/(\s+)/)
    .map((word, i) => {
      if (/^\([A-Z0-9&]+\)$/.test(word)) return word; // acronyms like (CDAE)
      const lower = word.toLowerCase();
      if (i > 0 && small.has(lower)) return lower;
      return lower.replace(/(^|['-])([a-z])/g, (_, p: string, c: string) => p + c.toUpperCase());
    })
    .join("");
}

/** "Signed up as": just the person's name. Older rows carry notes like
 *  "Master List row 12 (Name) via payment code", "(added) (manual)" or "vendor: Name". */
function signedUpAs(value: string): string {
  let v = value.trim();
  if (!v || v.startsWith("—")) return "";
  v = v.replace(/\s+via\s+.*$/i, "");
  const inRow = v.match(/row\s+\d+\s+\((.*)\)$/i);
  if (inRow) v = inRow[1];
  v = v.replace(/\((added|manual)\)/gi, "").replace(/^(vendor|membership|donation|member)\s*:\s*/i, "").trim();
  return tidyName(v);
}

const VIEW_LABEL: Record<PaymentsView, string> = {
  transfers: "e-Transfers in",
  debit: "e-Transfers out",
  invoice: "Bills",
  receipt: "Purchase receipts",
};

const EXPENSE_COLUMNS: Array<{ header: string; label: string }> = [
  { header: "Logged At", label: "Arrived" },
  { header: "Payee", label: "Payee" },
  { header: "Amount", label: "Amount" },
  { header: "Description", label: "Description" },
  { header: "Reference", label: "Reference" },
];

type ExpenseLogResponse = {
  headers?: string[];
  rows?: string[][];
  spreadsheetId?: string;
  tab?: string;
  error?: string;
};

function formatLogTime(value: string): string {
  const parsed = parseSheetDate(value);
  if (!parsed) return value || "";
  return parsed.toLocaleString("en-CA", { dateStyle: "medium", timeStyle: "short" });
}

function cellFor(headers: string[], row: string[], header: string): string {
  const index = headers.findIndex((h) => h.trim().toLowerCase() === header.toLowerCase());
  return index === -1 ? "" : String(row[index] ?? "");
}

function downloadCsv(filename: string, rows: string[][]) {
  const escape = (cell: string) => `"${(cell ?? "").replace(/"/g, '""')}"`;
  const blob = new Blob([rows.map((r) => r.map(escape).join(",")).join("\n")], {
    type: "text/csv;charset=utf-8;",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function DashboardInteracPanel() {
  const [log, setLog] = useState<{ headers: string[]; rows: string[][]; spreadsheetId: string } | null>(null);
  /** The payment staff are choosing a person for. */
  const [linking, setLinking] = useState<{ messageId: string; type: LinkKind; payer: string; amount: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [checkMessage, setCheckMessage] = useState("");
  const [query, setQuery] = useState("");
  const [savingId, setSavingId] = useState("");
  const [invoiceStatus, setInvoiceStatus] = useState<Record<string, string>>({});
  const [invoiceBusy, setInvoiceBusy] = useState("");

  const loadInvoices = useCallback(() => {
    fetch("/api/dashboard/invoices", { cache: "no-store" })
      .then((r) => r.json() as Promise<{ invoices?: Array<{ number: string; status: string }> }>)
      .then((d) => setInvoiceStatus(Object.fromEntries((d.invoices ?? []).map((i) => [i.number, i.status]))))
      .catch(() => undefined);
  }, []);

  const createInvoice = async (messageId: string) => {
    if (!log) return;
    setInvoiceBusy(messageId);
    setCheckMessage("");
    try {
      const res = await fetch("/api/dashboard/invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messageId }),
      });
      const d = (await res.json()) as { invoice?: { number: string; status: string }; error?: string };
      if (!res.ok || !d.invoice) throw new Error(d.error || "Couldn't create the receipt");
      const inv = d.invoice;
      const idCol = log.headers.findIndex((h) => h.trim().toLowerCase() === "gmail message id");
      const invCol = log.headers.findIndex((h) => h.trim().toLowerCase() === "invoice number");
      setLog({
        ...log,
        rows: log.rows.map((row) => {
          if (String(row[idCol] ?? "") !== messageId) return row;
          const next = [...row];
          next[invCol] = inv.number;
          return next;
        }),
      });
      setInvoiceStatus((m) => ({ ...m, [inv.number]: inv.status }));
      setCheckMessage(`Created receipt ${inv.number}.`);
    } catch (e) {
      setCheckMessage(e instanceof Error ? e.message : "Couldn't create the receipt");
    } finally {
      setInvoiceBusy("");
    }
  };

  const emailInvoice = async (number: string) => {
    setInvoiceBusy(number);
    setCheckMessage("");
    try {
      const res = await fetch("/api/dashboard/invoices/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ number }),
      });
      const d = (await res.json()) as { to?: string; error?: string };
      if (!res.ok || d.error) throw new Error(d.error || "Couldn't send the receipt");
      setInvoiceStatus((m) => ({ ...m, [number]: "Sent" }));
      setCheckMessage(`Emailed receipt ${number} to ${d.to}.`);
    } catch (e) {
      setCheckMessage(e instanceof Error ? e.message : "Couldn't send the receipt");
    } finally {
      setInvoiceBusy("");
    }
  };

  const applyLog = (data: PaymentsResponse) =>
    setLog({ headers: data.headers ?? [], rows: data.rows ?? [], spreadsheetId: data.spreadsheetId ?? "" });

  const loadLog = useCallback(() => {
    setLoading(true);
    setLoadError("");
    fetch("/api/dashboard/interac", { cache: "no-store" })
      .then((res) => res.json() as Promise<PaymentsResponse>)
      .then((data) => {
        if (data.error) setLoadError(data.error);
        else applyLog(data);
      })
      .catch(() => setLoadError("Failed to load payments."))
      .finally(() => setLoading(false));
  }, []);

  const checkInbox = async () => {
    setChecking(true);
    setCheckMessage("");
    try {
      const res = await fetch("/api/dashboard/interac", { method: "POST" });
      const data = (await res.json()) as PaymentsResponse;
      if (!res.ok || data.error) throw new Error(data.error || "Check failed");
      applyLog(data);
      const r = data.result;
      if (r) {
        const types = Object.entries(r.byType).map(([t, n]) => `${n} ${t}`).join(", ");
        setCheckMessage(
          r.logged
            ? `Logged ${r.logged} new payment${r.logged === 1 ? "" : "s"}: ${types}.`
            : "No new e-Transfers.",
        );
        if (r.errors.length) setLoadError(r.errors.join(" · "));
      }
    } catch (error) {
      setCheckMessage(error instanceof Error ? error.message : "Check failed");
    } finally {
      setChecking(false);
    }
  };

  const changeType = async (messageId: string, type: string) => {
    if (!log) return;
    setSavingId(messageId);
    const typeCol = log.headers.findIndex((h) => h.trim().toLowerCase() === "type");
    const idCol = log.headers.findIndex((h) => h.trim().toLowerCase() === "gmail message id");
    const previous = log;
    setLog({
      ...log,
      rows: log.rows.map((row) => {
        if (String(row[idCol] ?? "") !== messageId) return row;
        const next = [...row];
        next[typeCol] = type;
        return next;
      }),
    });
    try {
      const res = await fetch("/api/dashboard/interac", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messageId, type }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok || data.error) throw new Error(data.error || "Couldn't save");
      const row = previous.rows.find((r) => String(r[idCol] ?? "") === messageId);
      if (row && isLinkKind(type) && !cellFor(previous.headers, row, "Matched To").trim()) {
        setLinking({
          messageId,
          type,
          payer: tidyName(cellFor(previous.headers, row, "Payer Name")),
          amount: cellFor(previous.headers, row, "Amount"),
        });
      }
    } catch (error) {
      setLog(previous);
      setCheckMessage(error instanceof Error ? error.message : "Couldn't save");
    } finally {
      setSavingId("");
    }
  };

  const [view, setView] = useState<PaymentsView>("transfers");
  const [expenseLog, setExpenseLog] = useState<{
    headers: string[];
    rows: string[][];
    spreadsheetId: string;
    tab: string;
  } | null>(null);
  const [expenseLoading, setExpenseLoading] = useState(false);
  const [expenseError, setExpenseError] = useState("");

  const loadExpenses = useCallback((kind: ExpenseView) => {
    setExpenseLoading(true);
    setExpenseError("");
    fetch(`/api/dashboard/expenses?type=${kind}`, { cache: "no-store" })
      .then((res) => res.json() as Promise<ExpenseLogResponse>)
      .then((data) => {
        if (data.error) setExpenseError(data.error);
        else
          setExpenseLog({
            headers: data.headers ?? [],
            rows: data.rows ?? [],
            spreadsheetId: data.spreadsheetId ?? "",
            tab: data.tab ?? "Expenses",
          });
      })
      .catch(() => setExpenseError("Failed to load expenses."))
      .finally(() => setExpenseLoading(false));
  }, []);

  useEffect(() => {
    if (view === "transfers") {
      loadLog();
      loadInvoices();
    } else loadExpenses(view);
  }, [view, loadLog, loadExpenses, loadInvoices]);

  const visibleRows = useMemo(() => {
    if (!log) return [];
    const q = query.trim().toLowerCase();
    if (!q) return log.rows;
    return log.rows.filter((row) =>
      [...LOG_COLUMNS.map((c) => c.header), "Type"].some((h) => cellFor(log.headers, row, h).toLowerCase().includes(q)),
    );
  }, [log, query]);

  const visibleExpenseRows = useMemo(() => {
    if (!expenseLog) return [];
    const q = query.trim().toLowerCase();
    if (!q) return expenseLog.rows;
    return expenseLog.rows.filter((row) =>
      EXPENSE_COLUMNS.some((col) => cellFor(expenseLog.headers, row, col.header).toLowerCase().includes(q)),
    );
  }, [expenseLog, query]);

  const isExpenseView = view !== "transfers";
  const activeError = isExpenseView ? expenseError : loadError;
  const activeLoading = isExpenseView ? expenseLoading : loading;
  const needsGoogleConnect = /no google account (is )?connected/i.test(activeError);
  const needsEnvConfig = /is not configured/i.test(activeError);
  const activeSheetId = isExpenseView ? expenseLog?.spreadsheetId : log?.spreadsheetId;
  const sheetsHref = activeSheetId ? `https://docs.google.com/spreadsheets/d/${activeSheetId}/edit` : undefined;

  const refresh = () => {
    if (view === "transfers") loadLog();
    else loadExpenses(view);
  };

  const exportCsv = () => {
    if (isExpenseView) {
      if (!expenseLog) return;
      downloadCsv(`${view}s.csv`, [
        [...EXPENSE_COLUMNS.map((col) => col.label), "Attachment Link"],
        ...visibleExpenseRows.map((row) => [
          ...EXPENSE_COLUMNS.map((col) => cellFor(expenseLog.headers, row, col.header)),
          cellFor(expenseLog.headers, row, "Attachment Link"),
        ]),
      ]);
      return;
    }
    if (!log) return;
    downloadCsv("payments.csv", [
      [...LOG_COLUMNS.map((col) => col.label), "Type"],
      ...visibleRows.map((row) => [
        ...LOG_COLUMNS.map((col) => cellFor(log.headers, row, col.header)),
        cellFor(log.headers, row, "Type"),
      ]),
    ]);
  };

  return (
    <div className="dash-panel">
      <header className="dash-panel-head">
        <div className="dash-panel-heading">
          <h2 className="dash-panel-title">Payments</h2>
          <div className="dash-panel-tabs">
            <Segmented
              label="What to show"
              value={view}
              onChange={setView}
              options={(["transfers", "debit", "invoice", "receipt"] as const).map((v) => ({ value: v, label: VIEW_LABEL[v] }))}
            />
          </div>
        </div>
        <div className="dash-panel-actions">
          <div className="dash-actions-row dash-actions-row--search">
            <div className="dash-search-wrap">
              <Search size={15} aria-hidden />
              <input
                type="search"
                className="dash-search-input"
                placeholder={`Search ${VIEW_LABEL[view].toLowerCase()}…`}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                disabled={isExpenseView ? !expenseLog || expenseLog.rows.length === 0 : !log || log.rows.length === 0}
              />
            </div>
          </div>
          <div className="dash-actions-row dash-actions-row--primary">
            {!isExpenseView && (
              <button
                type="button"
                className="dash-primary-btn focus-ring-light"
                onClick={checkInbox}
                disabled={checking || loading}
                title="Look for new Interac e-Transfers now"
              >
                <Busy busy={checking}>
                  <Inbox size={16} aria-hidden />
                  Check inbox
                </Busy>
              </button>
            )}
            {isExpenseView && (
              <button
                type="button"
                className="dash-action-btn focus-ring-light"
                onClick={refresh}
                disabled={activeLoading}
                title={`Reload ${VIEW_LABEL[view]}`}
              >
                <Busy busy={activeLoading}>
                  <RefreshCw size={16} aria-hidden />
                  Refresh
                </Busy>
              </button>
            )}
            <button
              type="button"
              className="dash-action-btn focus-ring-light"
              onClick={exportCsv}
              disabled={isExpenseView ? !expenseLog || visibleExpenseRows.length === 0 : !log || visibleRows.length === 0}
            >
              <Download size={16} aria-hidden />
              Download
            </button>
            <a
              className="dash-action-btn focus-ring-light"
              href={sheetsHref}
              target="_blank"
              rel="noreferrer"
              onClick={(e) => {
                if (!sheetsHref) e.preventDefault();
              }}
              aria-disabled={!sheetsHref}
            >
              Open in Sheets
            </a>
          </div>
        </div>
      </header>

      {checkMessage && <p className="dash-interac-summary dash-muted">{checkMessage}</p>}

      {isExpenseView && expenseLoading && (
        <div className="dash-empty">
          <p className="dash-muted">Loading…</p>
        </div>
      )}

      {isExpenseView && !expenseLoading && expenseError && (
        <div className="dash-empty">
          <p>Couldn&rsquo;t load {VIEW_LABEL[view].toLowerCase()}.</p>
          <p className="dash-muted">{expenseError}</p>
          {needsEnvConfig && (
            <p className="dash-muted">
              Set the missing spreadsheet id on Vercel (Production), redeploy, then refresh.
            </p>
          )}
          {needsGoogleConnect && (
            <p className="dash-muted">
              <a className="dash-action-btn focus-ring-light inline-flex" href="/api/google/connect">
                Connect Google
              </a>
            </p>
          )}
        </div>
      )}

      {isExpenseView && !expenseLoading && !expenseError && expenseLog && expenseLog.rows.length === 0 && (
        <div className="dash-empty">
          <p>No {VIEW_LABEL[view].toLowerCase()} logged yet.</p>
          <p className="dash-muted">
            New {VIEW_LABEL[view].toLowerCase()} are picked up from those inboxes on a schedule. Refresh reloads this list.
          </p>
        </div>
      )}

      {isExpenseView &&
        !expenseLoading &&
        !expenseError &&
        expenseLog &&
        expenseLog.rows.length > 0 &&
        visibleExpenseRows.length === 0 && (
          <div className="dash-empty">
            <p>No matches.</p>
            <p className="dash-muted">
              Nothing in {VIEW_LABEL[view].toLowerCase()} matches “{query.trim()}”.
            </p>
          </div>
        )}

      {isExpenseView && !expenseLoading && !expenseError && expenseLog && visibleExpenseRows.length > 0 && (
        <div className="dash-table-wrap">
          <table className="dash-table dash-table--expenses">
            <thead>
              <tr>
                {EXPENSE_COLUMNS.map((col) => (
                  <th key={col.header}>{col.label}</th>
                ))}
                <th>Attachment</th>
              </tr>
            </thead>
            <tbody>
              {visibleExpenseRows.map((row, i) => {
                const id = cellFor(expenseLog.headers, row, "Gmail Message ID") || String(i);
                const link = cellFor(expenseLog.headers, row, "Attachment Link");
                return (
                  <tr key={id}>
                    {EXPENSE_COLUMNS.map((col) => {
                      const value = cellFor(expenseLog.headers, row, col.header);
                      return (
                        <td
                          key={col.header}
                          className={col.header === "Description" ? "dash-td-memo" : undefined}
                        >
                          {col.header === "Logged At"
                            ? formatLogTime(value)
                            : col.header === "Amount" && value
                              ? `$${value}`
                              : value || <span className="dash-empty-cell" aria-label="Empty">–</span>}
                        </td>
                      );
                    })}
                    <td>
                      {link ? (
                        <a className="dash-action-btn focus-ring-light" href={link} target="_blank" rel="noreferrer">
                          View
                        </a>
                      ) : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {!isExpenseView && loading && !log && (
        <div className="dash-empty">
          <p className="dash-muted">Loading…</p>
        </div>
      )}

      {!isExpenseView && !(loading && !log) && loadError && (
        <div className="dash-empty">
          <p>Couldn&rsquo;t load payments.</p>
          <p className="dash-muted">{loadError}</p>
          {needsEnvConfig && (
            <p className="dash-muted">Set the missing setting on Vercel (Production), redeploy, then refresh.</p>
          )}
          {needsGoogleConnect && (
            <p className="dash-muted">
              <a className="dash-action-btn focus-ring-light inline-flex" href="/api/google/connect">
                Connect Google
              </a>
            </p>
          )}
        </div>
      )}

      {!isExpenseView && !(loading && !log) && !loadError && log && log.rows.length === 0 && (
        <div className="dash-empty">
          <p>No payments logged yet.</p>
          <p className="dash-muted">New e-Transfers are picked up daily, or press Check inbox.</p>
        </div>
      )}

      {!isExpenseView && !(loading && !log) && !loadError && log && log.rows.length > 0 && visibleRows.length === 0 && (
        <div className="dash-empty">
          <p>No matches.</p>
          <p className="dash-muted">Nothing in Payments matches “{query.trim()}”.</p>
        </div>
      )}

      {!isExpenseView && !(loading && !log) && !loadError && log && visibleRows.length > 0 && (
        <div className="dash-table-wrap">
          <table className="dash-table dash-table--transfers">
            <thead>
              <tr>
                {LOG_COLUMNS.map((col) => (
                  <th key={col.header}>{col.label}</th>
                ))}
                <th>Type</th>
              </tr>
            </thead>
            <tbody>
              {visibleRows.map((row, i) => {
                const messageId = cellFor(log.headers, row, "Gmail Message ID");
                const type = cellFor(log.headers, row, "Type");
                return (
                  <tr key={messageId || i}>
                    {LOG_COLUMNS.map((col) => {
                      const value = cellFor(log.headers, row, col.header);
                      return (
                        <td
                          key={col.header}
                          className={col.header === "Memo" || col.header === "Matched To" ? "dash-td-memo" : undefined}
                        >
                          {(() => {
                            const shown =
                              col.header === "Received"
                                ? formatLogTime(value)
                                : col.header === "Amount" && value
                                  ? `$${value}`
                                  : col.header === "Matched To"
                                    ? signedUpAs(value)
                                    : col.header === "Payer Name"
                                      ? tidyName(value)
                                      : value;
                            return shown || <span className="dash-empty-cell" aria-label="Empty">–</span>;
                          })()}
                        </td>
                      );
                    })}
                    <td>
                      <label className="dash-select-wrap">
                        <span className="sr-only">Payment type</span>
                        <select
                          className="dash-select focus-ring-light"
                          value={type}
                          disabled={!messageId || savingId === messageId}
                          onChange={(e) => changeType(messageId, e.target.value)}
                        >
                          {!type && <option value="">Needs a look</option>}
                          {PAYMENT_TYPES.filter((t) => t !== "Blocked" || type === "Blocked").map((t) => (
                            <option key={t} value={t}>
                              {TYPE_LABEL[t] ?? t}
                            </option>
                          ))}
                        </select>
                      </label>
                      <div className="dash-invoice-actions">
                      {isLinkKind(type) && !cellFor(log.headers, row, "Matched To").trim() && (
                        <button
                          type="button"
                          className="dash-text-btn focus-ring-light"
                          onClick={() =>
                            setLinking({
                              messageId,
                              type,
                              payer: tidyName(cellFor(log.headers, row, "Payer Name")),
                              amount: cellFor(log.headers, row, "Amount"),
                            })
                          }
                        >
                          Who is this for?
                        </button>
                      )}
                      {(() => {
                        const number = cellFor(log.headers, row, "Invoice Number");
                        if (number) {
                          const sent = invoiceStatus[number] === "Sent";
                          return (
                            <>
                              <a
                                className="dash-action-btn focus-ring-light"
                                href={`/api/dashboard/invoices/pdf?number=${encodeURIComponent(number)}`}
                                target="_blank"
                                rel="noreferrer"
                                title={`Open ${number}`}
                              >
                                <FileText size={15} />
                                {number}
                              </a>
                              <button
                                type="button"
                                className="dash-action-btn focus-ring-light"
                                onClick={() => emailInvoice(number)}
                                disabled={invoiceBusy === number}
                              >
                                <Busy busy={invoiceBusy === number}>
                                  <Send size={15} aria-hidden />
                                  {sent ? "Email again" : "Email receipt"}
                                </Busy>
                              </button>
                            </>
                          );
                        }
                        if (type !== "Service") return null;
                        if (!cellFor(log.headers, row, "Payer Email").trim()) {
                          return <span className="dash-cell-note">No email on this payment, so a receipt can&rsquo;t be sent.</span>;
                        }
                        return (
                          <button
                            type="button"
                            className="dash-action-btn focus-ring-light"
                            onClick={() => createInvoice(messageId)}
                            disabled={!messageId || invoiceBusy === messageId}
                          >
                            <Busy busy={invoiceBusy === messageId}>
                              <FileText size={15} aria-hidden />
                              Create receipt
                            </Busy>
                          </button>
                        );
                      })()}
                      </div>
                    </td>

                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {linking && (
        <LinkPicker
          {...linking}
          onClose={() => setLinking(null)}
          onLinked={(name) => {
            setLinking(null);
            setCheckMessage(`Marked ${name} as paid.`);
            refresh();
          }}
        />
      )}
    </div>
  );
}

type UnpaidSignup = { tab: string; rowNumber: number; name: string; email: string; code: string; signedUp: string };

const KIND_WORD: Record<LinkKind, string> = { Membership: "membership", Donation: "donation", Vendor: "vendor fee" };

/** "Who is this payment for?": pick the unpaid sign-up an e-Transfer belongs to. */
function LinkPicker({
  messageId,
  type,
  payer,
  amount,
  onClose,
  onLinked,
}: {
  messageId: string;
  type: LinkKind;
  payer: string;
  amount: string;
  onClose: () => void;
  onLinked: (name: string) => void;
}) {
  const [people, setPeople] = useState<UnpaidSignup[] | null>(null);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [saving, setSaving] = useState("");

  useEffect(() => {
    fetch(`/api/dashboard/signups?type=${type}`, { cache: "no-store" })
      .then((r) => r.json() as Promise<{ signups?: UnpaidSignup[]; error?: string }>)
      .then((d) => (d.signups ? setPeople(d.signups) : setError(d.error || "Couldn't load sign-ups")))
      .catch(() => setError("Couldn't load sign-ups"));
  }, [type]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const pick = async (p: UnpaidSignup) => {
    setSaving(`${p.tab}:${p.rowNumber}`);
    setError("");
    try {
      const res = await fetch("/api/dashboard/signups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "link", messageId, tab: p.tab, rowNumber: p.rowNumber }),
      });
      const d = (await res.json()) as { name?: string; error?: string };
      if (!res.ok || d.error) throw new Error(d.error || "Couldn't save");
      onLinked(d.name || p.name);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save");
      setSaving("");
    }
  };

  const q = query.trim().toLowerCase();
  const shown = (people ?? []).filter((p) => !q || `${p.name} ${p.email} ${p.code}`.toLowerCase().includes(q));

  return (
    <div className="dash-modal-backdrop" onClick={onClose}>
      <div className="dash-modal dash-modal--narrow" role="dialog" aria-modal="true" aria-label="Who is this payment for?" onClick={(e) => e.stopPropagation()}>
        <div className="dash-modal-head">
          <div>
            <h3 className="dash-emails-section-title">Who is this payment for?</h3>
            <p className="dash-section-lead">
              {payer || "Someone"} sent ${amount}. Pick the person whose {KIND_WORD[type]} it pays for. They&rsquo;ll be marked as paid and their
              reminders will stop.
            </p>
          </div>
          <button type="button" className="dash-text-btn focus-ring-light" onClick={onClose}>
            Not now
          </button>
        </div>
        <div style={{ padding: "0 1.25rem" }}>
          <input
            className="dash-input focus-ring-light"
            style={{ width: "100%" }}
            type="search"
            placeholder="Search by name, email or payment code"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoFocus
          />
        </div>
        {error && <p className="dash-field-hint" style={{ padding: "0 1.25rem" }}>{error}</p>}
        <div className="dash-modal-list">
          {!people && !error && <p className="dash-field-hint">Loading…</p>}
          {people && shown.length === 0 && (
            <p className="dash-field-hint">
              {people.length === 0 ? `Nobody is waiting to pay a ${KIND_WORD[type]}.` : "Nobody matches that search."}
            </p>
          )}
          {shown.length > 0 && (
            <ul className="dash-email-list">
              {shown.map((p) => {
                const key = `${p.tab}:${p.rowNumber}`;
                return (
                  <li key={key} className="dash-email-item dash-email-item--static">
                    <span className="dash-email-item-text">
                      <span className="dash-email-item-name">{p.name || p.email}</span>
                      <span className="dash-email-item-meta">{[p.email, p.code].filter(Boolean).join(", ")}</span>
                    </span>
                    <button type="button" className="dash-action-btn focus-ring-light" onClick={() => pick(p)} disabled={Boolean(saving)}>
                      <Busy busy={saving === key}>This person</Busy>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
