"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Download, Link2, RefreshCw, Search, X } from "lucide-react";
import { parseSheetDate } from "@/lib/sheet-dates";
import type { InteracKind, InteracMatchCandidate } from "@/lib/interac-payments";

const KIND_LABEL: Record<InteracKind, string> = {
  master: "Master List",
  membership: "Members",
  donation: "Donations",
  vendor: "Vendors",
};

const DEST_KINDS = ["membership", "donation", "vendor"] as const;
type DestKind = (typeof DEST_KINDS)[number];

function sameEmail(a: string, b: string): boolean {
  const left = a.trim().toLowerCase();
  const right = b.trim().toLowerCase();
  return Boolean(left && right && left === right);
}

type InteracLogResponse = {
  headers?: string[];
  rows?: string[][];
  spreadsheetId?: string;
  tab?: string;
  error?: string;
};

const LOG_COLUMNS: Array<{ header: string; label: string }> = [
  { header: "Logged At", label: "Arrived" },
  { header: "Inbox", label: "Inbox" },
  { header: "Payer Name", label: "Name" },
  { header: "Payer Email", label: "From" },
  { header: "Amount", label: "Amount" },
  { header: "Message", label: "Memo" },
];

type ExpenseView = "debit" | "invoice" | "receipt";
type PaymentsView = "transfers" | ExpenseView;

const VIEW_LABEL: Record<PaymentsView, string> = {
  transfers: "e-Transfers",
  debit: "Debits",
  invoice: "Invoices",
  receipt: "Receipts",
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
  if (!parsed) return value || "—";
  return parsed.toLocaleString("en-CA", {
    timeZone: "America/Edmonton",
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function cellFor(headers: string[], row: string[], header: string): string {
  const index = headers.findIndex((h) => h.trim().toLowerCase() === header.toLowerCase());
  return index === -1 ? "" : String(row[index] ?? "");
}

function isUnmatched(headers: string[], row: string[]): boolean {
  const matched = cellFor(headers, row, "Matched").trim();
  const status = cellFor(headers, row, "Status");
  if (/unmatched/i.test(status)) return true;
  return !matched;
}

export function DashboardInteracPanel() {
  const [log, setLog] = useState<{ headers: string[]; rows: string[][]; spreadsheetId: string; tab: string } | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [checkMessage, setCheckMessage] = useState("");
  const [query, setQuery] = useState("");
  const [matchFor, setMatchFor] = useState<{
    messageId: string;
    name: string;
    email: string;
    amount: string;
  } | null>(null);
  const [candidates, setCandidates] = useState<InteracMatchCandidate[] | null>(null);
  const [candidatesError, setCandidatesError] = useState("");
  const [candidateQuery, setCandidateQuery] = useState("");
  const [kindFilter, setKindFilter] = useState<InteracKind | "all">("all");
  const [selectedId, setSelectedId] = useState("");
  const [targetKind, setTargetKind] = useState<DestKind | "">("");
  const [matching, setMatching] = useState(false);
  const [matchError, setMatchError] = useState("");
  const autoFilledFor = useRef("");

  const applyLog = (data: InteracLogResponse) => {
    setLog({
      headers: data.headers ?? [],
      rows: data.rows ?? [],
      spreadsheetId: data.spreadsheetId ?? "",
      tab: data.tab ?? "Interac Log",
    });
  };

  const loadLog = useCallback(() => {
    setLoading(true);
    setLoadError("");
    fetch("/api/dashboard/interac", { cache: "no-store" })
      .then((res) => res.json() as Promise<InteracLogResponse>)
      .then((data) => {
        if (data.error) setLoadError(data.error);
        else applyLog(data);
      })
      .catch(() => setLoadError("Failed to load Interac e-Transfers."))
      .finally(() => setLoading(false));
  }, []);

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
    if (view === "transfers") loadLog();
    else loadExpenses(view);
  }, [view, loadLog, loadExpenses]);

  const visibleRows = useMemo(() => {
    if (!log) return [];
    const q = query.trim().toLowerCase();
    if (!q) return log.rows;
    return log.rows.filter((row) =>
      LOG_COLUMNS.some((col) => cellFor(log.headers, row, col.header).toLowerCase().includes(q)),
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

  const openMatch = (row: string[]) => {
    if (!log) return;
    const name = cellFor(log.headers, row, "Payer Name");
    const email = cellFor(log.headers, row, "Payer Email");
    setMatchFor({
      messageId: cellFor(log.headers, row, "Gmail Message ID"),
      name,
      email,
      amount: cellFor(log.headers, row, "Amount"),
    });
    setSelectedId("");
    setTargetKind("");
    setCandidateQuery((email || name).trim());
    setKindFilter("all");
    setMatchError("");
    autoFilledFor.current = "";
    if (!candidates) {
      setCandidatesError("");
      fetch("/api/dashboard/interac/candidates", { cache: "no-store" })
        .then((res) => res.json() as Promise<{ candidates?: InteracMatchCandidate[]; error?: string }>)
        .then((data) => {
          if (data.error) setCandidatesError(data.error);
          else setCandidates(data.candidates ?? []);
        })
        .catch(() => setCandidatesError("Failed to load people to match."));
    }
  };

  useEffect(() => {
    if (!matchFor || !candidates) return;
    if (autoFilledFor.current === matchFor.messageId) return;
    autoFilledFor.current = matchFor.messageId;

    const email = matchFor.email.trim();
    const name = matchFor.name.trim();
    const master = candidates.filter((c) => c.kind === "master");
    const byEmail = email ? master.filter((c) => sameEmail(c.email, email)) : [];
    const byName = name
      ? master.filter((c) => c.name.toLowerCase().includes(name.toLowerCase()))
      : [];
    const hit = byEmail[0] ?? (byName.length === 1 ? byName[0] : undefined);

    if (byEmail.length > 0) setCandidateQuery(email);
    else if (byName.length > 0) setCandidateQuery(name);
    else setCandidateQuery(email || name);

    if (!hit) return;
    setSelectedId(hit.id);
  }, [matchFor, candidates]);

  const filteredCandidates = useMemo(() => {
    const list = candidates ?? [];
    const q = candidateQuery.trim().toLowerCase();
    const hasMaster = list.some((c) => c.kind === "master");
    return list.filter((c) => {
      if (kindFilter === "all") {
        if (hasMaster ? c.kind !== "master" : c.kind === "master") return false;
      } else if (c.kind !== kindFilter) {
        return false;
      }
      if (!q) return true;
      return c.name.toLowerCase().includes(q) || c.email.toLowerCase().includes(q);
    });
  }, [candidates, candidateQuery, kindFilter]);

  const submitMatch = async () => {
    if (!matchFor || !selectedId || !log) return;
    const picked = (candidates ?? []).find((c) => c.id === selectedId);
    if (!picked) return;
    if (picked.kind === "master" && !targetKind) {
      setMatchError("Choose Members, Donations, or Vendors under their name.");
      return;
    }

    setMatching(true);
    setMatchError("");
    try {
      const res = await fetch("/api/dashboard/interac", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messageId: matchFor.messageId,
          kind: picked.kind,
          rowNumber: picked.rowNumber,
          targetKind: picked.kind === "master" ? targetKind : undefined,
          amount: matchFor.amount,
        }),
      });
      const data = (await res.json()) as { matched?: string; error?: string };
      if (!res.ok || data.error) throw new Error(data.error || "Could not match");
      const matched = data.matched ?? "";
      setLog((prev) => {
        if (!prev) return prev;
        const idCol = prev.headers.findIndex((h) => h.trim().toLowerCase() === "gmail message id");
        const matchedCol = prev.headers.findIndex((h) => h.trim().toLowerCase() === "matched");
        const statusCol = prev.headers.findIndex((h) => h.trim().toLowerCase() === "status");
        return {
          ...prev,
          rows: prev.rows.map((row) => {
            if (idCol < 0 || String(row[idCol] ?? "").trim() !== matchFor.messageId) return row;
            const next = [...row];
            if (matchedCol >= 0) next[matchedCol] = matched;
            if (statusCol >= 0) next[statusCol] = "Matched — manual";
            return next;
          }),
        };
      });
      setMatchFor(null);
      setCandidates(null);
      setCheckMessage(
        `Matched ${picked.name} on ${KIND_LABEL[picked.kind === "master" && targetKind ? targetKind : picked.kind]}`,
      );
    } catch (error) {
      setMatchError(error instanceof Error ? error.message : "Could not match");
    } finally {
      setMatching(false);
    }
  };

  const isExpenseView = view !== "transfers";
  const activeError = isExpenseView ? expenseError : loadError;
  const activeLoading = isExpenseView ? expenseLoading : loading;
  const needsGoogleConnect = /no google account connected/i.test(activeError);
  const needsEnvConfig = /is not configured/i.test(activeError);
  const sheetsHref = (isExpenseView ? expenseLog?.spreadsheetId : log?.spreadsheetId)
    ? `https://docs.google.com/spreadsheets/d/${isExpenseView ? expenseLog?.spreadsheetId : log?.spreadsheetId}/edit`
    : undefined;

  const refresh = () => {
    if (view === "transfers") loadLog();
    else loadExpenses(view);
  };

  const exportCsv = () => {
    if (isExpenseView) {
      if (!expenseLog) return;
      const escape = (cell: string) => `"${(cell ?? "").replace(/"/g, '""')}"`;
      const csv = [
        [...EXPENSE_COLUMNS.map((col) => col.label), "Attachment Link"],
        ...visibleExpenseRows.map((row) => [
          ...EXPENSE_COLUMNS.map((col) => cellFor(expenseLog.headers, row, col.header)),
          cellFor(expenseLog.headers, row, "Attachment Link"),
        ]),
      ]
        .map((r) => r.map(escape).join(","))
        .join("\n");
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${view}s.csv`;
      a.click();
      URL.revokeObjectURL(url);
      return;
    }
    if (!log) return;
    const escape = (cell: string) => `"${(cell ?? "").replace(/"/g, '""')}"`;
    const csv = [LOG_COLUMNS.map((col) => col.label), ...visibleRows.map((row) => LOG_COLUMNS.map((col) => cellFor(log.headers, row, col.header)))]
      .map((r) => r.map(escape).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "interac-transfers.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="dash-panel">
      <header className="dash-panel-head">
        <div className="dash-panel-heading">
          <h2 className="dash-panel-title">Payments</h2>
        </div>
        <div className="dash-panel-actions">
          <div className="dash-actions-row dash-actions-row--search">
            <label className="dash-select-wrap">
              <select
                className="dash-select focus-ring-light"
                value={view}
                onChange={(e) => setView(e.target.value as PaymentsView)}
              >
                {(["transfers", "debit", "invoice", "receipt"] as const).map((v) => (
                  <option key={v} value={v}>
                    {VIEW_LABEL[v]}
                  </option>
                ))}
              </select>
            </label>
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
            <button
              type="button"
              className="dash-action-btn focus-ring-light"
              onClick={refresh}
              disabled={activeLoading}
              title={`Reload ${VIEW_LABEL[view]}`}
            >
              <RefreshCw size={16} className={activeLoading ? "dash-spin" : undefined} />
              Refresh
            </button>
            <button
              type="button"
              className="dash-action-btn focus-ring-light"
              onClick={exportCsv}
              disabled={isExpenseView ? !expenseLog || visibleExpenseRows.length === 0 : !log || visibleRows.length === 0}
            >
              <Download size={16} />
              Export CSV
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
          <table className="dash-table">
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
                              : value || "—"}
                        </td>
                      );
                    })}
                    <td>
                      {link ? (
                        <a className="dash-action-btn focus-ring-light" href={link} target="_blank" rel="noreferrer">
                          View
                        </a>
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {!isExpenseView && loading && (
        <div className="dash-empty">
          <p className="dash-muted">Loading…</p>
        </div>
      )}

      {!isExpenseView && !loading && loadError && (
        <div className="dash-empty">
          <p>Couldn&rsquo;t load Interac e-Transfers.</p>
          <p className="dash-muted">{loadError}</p>
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

      {!isExpenseView && !loading && !loadError && log && log.rows.length === 0 && (
        <div className="dash-empty">
          <p>No Interac e-Transfers logged yet.</p>
          <p className="dash-muted">
            New e-Transfers are picked up from those inboxes on a schedule. Refresh reloads this list.
          </p>
        </div>
      )}

      {!isExpenseView && !loading && !loadError && log && log.rows.length > 0 && visibleRows.length === 0 && (
        <div className="dash-empty">
          <p>No matches.</p>
          <p className="dash-muted">Nothing in the Interac log matches “{query.trim()}”.</p>
        </div>
      )}

      {!isExpenseView && !loading && !loadError && log && visibleRows.length > 0 && (
        <div className="dash-table-wrap">
          <table className="dash-table">
            <thead>
              <tr>
                {LOG_COLUMNS.map((col) => (
                  <th key={col.header}>{col.label}</th>
                ))}
                <th className="dash-th-actions" aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {visibleRows.map((row, i) => {
                const id = [
                  cellFor(log.headers, row, "Inbox"),
                  cellFor(log.headers, row, "Gmail Message ID") || String(i),
                ].join(":");
                const unmatched = isUnmatched(log.headers, row);
                const matchedName = cellFor(log.headers, row, "Matched");
                const status = cellFor(log.headers, row, "Status");
                return (
                  <tr key={id}>
                    {LOG_COLUMNS.map((col) => {
                      const value = cellFor(log.headers, row, col.header);
                      return (
                        <td
                          key={col.header}
                          className={col.header === "Message" ? "dash-td-memo" : undefined}
                        >
                          {col.header === "Logged At"
                            ? formatLogTime(value)
                            : col.header === "Amount" && value
                              ? `$${value}`
                              : value || "—"}
                        </td>
                      );
                    })}
                    <td className="dash-row-actions">
                      {unmatched ? (
                        <button
                          type="button"
                          className="dash-action-btn focus-ring-light"
                          onClick={() => openMatch(row)}
                          disabled={!cellFor(log.headers, row, "Gmail Message ID")}
                        >
                          <Link2 size={15} />
                          Match
                        </button>
                      ) : (
                        <span className="dash-matched-chip" title={matchedName ? `${status || "Matched"} — ${matchedName}` : status || "Matched"}>
                          Matched
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {matchFor && (
        <>
          <button
            type="button"
            className="dash-match-backdrop"
            aria-label="Close match dialog"
            onClick={() => !matching && setMatchFor(null)}
          />
          <div className="dash-match-dialog" role="dialog" aria-modal="true" aria-labelledby="dash-match-title">
            <div className="dash-match-dialog-head">
              <div>
                <h3 id="dash-match-title" className="dash-match-title">
                  Match e-Transfer
                </h3>
                <p className="dash-muted">
                  {[matchFor.name, matchFor.email || "No payer email", matchFor.amount ? `$${matchFor.amount}` : ""]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              </div>
              <button
                type="button"
                className="dash-icon-btn dash-icon-btn--ink focus-ring-light"
                onClick={() => setMatchFor(null)}
                disabled={matching}
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>

            <div className="dash-match-kinds" role="tablist" aria-label="List">
              {(["all", "membership", "donation", "vendor"] as const).map((kind) => (
                <button
                  key={kind}
                  type="button"
                  role="tab"
                  aria-selected={kindFilter === kind}
                  className={`dash-email-flow-tab focus-ring-light${kindFilter === kind ? " dash-email-flow-tab--active" : ""}`}
                  onClick={() => {
                    setKindFilter(kind);
                    if (kind !== "all") setTargetKind("");
                    setMatchError("");
                  }}
                >
                  {kind === "all" ? "Master List" : KIND_LABEL[kind]}
                </button>
              ))}
            </div>

            <div className="dash-search-wrap dash-match-search">
              <Search size={15} aria-hidden />
              <input
                type="search"
                className="dash-search-input"
                placeholder="Search name or email…"
                value={candidateQuery}
                onChange={(e) => setCandidateQuery(e.target.value)}
                autoFocus
              />
            </div>

            {candidatesError && <p className="dash-error">{candidatesError}</p>}
            {matchError && <p className="dash-error">{matchError}</p>}
            {!candidates && !candidatesError && <p className="dash-muted">Loading people…</p>}

            {candidates && filteredCandidates.length === 0 && (
              <p className="dash-muted">
                {kindFilter === "all" && candidateQuery.trim()
                  ? "They're not on Master List. Search another name, or open Members, Donations, or Vendors."
                  : "Nobody on this list matches that search."}
              </p>
            )}

            {candidates && filteredCandidates.length > 0 && (
              <ul className="dash-match-list">
                {filteredCandidates.map((c) => {
                  const selected = selectedId === c.id;
                  if (c.kind === "master") {
                    return (
                      <li key={c.id}>
                        <div
                          className={`dash-match-option${selected ? " dash-match-option--selected" : ""}`}
                        >
                          <span className="dash-match-option-name">
                            {c.name}
                            {c.paid ? <span className="dash-source-chip">Already paid</span> : null}
                          </span>
                          <span className="dash-muted">{c.email || "No email"}</span>
                          <div className="dash-match-dests" role="group" aria-label={`Match ${c.name} to`}>
                            {DEST_KINDS.map((kind) => {
                              const on = selected && targetKind === kind;
                              return (
                                <button
                                  key={kind}
                                  type="button"
                                  className={`dash-match-dest focus-ring-light${on ? " dash-match-dest--on" : ""}`}
                                  disabled={matching}
                                  title={`Match to ${KIND_LABEL[kind]}`}
                                  aria-pressed={on}
                                  onClick={() => {
                                    setSelectedId(c.id);
                                    setTargetKind(kind);
                                    setMatchError("");
                                  }}
                                >
                                  {KIND_LABEL[kind]}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      </li>
                    );
                  }
                  return (
                    <li key={c.id}>
                      <button
                        type="button"
                        className={`dash-match-option focus-ring-light${selected ? " dash-match-option--selected" : ""}`}
                        onClick={() => {
                          setSelectedId(c.id);
                          setTargetKind(c.kind as DestKind);
                          setMatchError("");
                        }}
                      >
                        <span className="dash-match-option-name">
                          {c.name}
                          {c.paid ? <span className="dash-source-chip">Already paid</span> : null}
                          {c.legacy ? <span className="dash-source-chip">Old WPForms row</span> : null}
                        </span>
                        <span className="dash-muted">
                          {KIND_LABEL[c.kind]}
                          {c.email ? ` · ${c.email}` : ""}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}

            <div className="dash-match-dialog-actions">
              <button
                type="button"
                className="dash-action-btn focus-ring-light"
                onClick={() => setMatchFor(null)}
                disabled={matching}
              >
                Cancel
              </button>
              <button
                type="button"
                className="dash-primary-btn focus-ring-light"
                onClick={submitMatch}
                disabled={
                  matching ||
                  !selectedId ||
                  ((candidates ?? []).find((c) => c.id === selectedId)?.kind === "master" && !targetKind)
                }
              >
                {matching ? "Matching…" : "Mark paid"}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
