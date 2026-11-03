"use client";

import { Busy, Segmented } from "@/components/dashboard/ui";
import { PushToggle } from "@/components/dashboard/push-toggle";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ExternalLink,
  Download,
  RefreshCw,
  Search,
  Pencil,
  Check,
  X,
  Plus,
  ListFilter,
} from "lucide-react";
import type { DashboardListId } from "@/lib/dashboard-lists";
import { listMeta } from "@/lib/dashboard-lists";
import {
  cellMatchesDateQuery,
  defaultValueForDateHeader,
  findDateColumnIndex,
  formatIsoDayLabel,
  isTimestampHeader,
  parseSheetDate,
  rowMatchesDateFilter,
} from "@/lib/sheet-dates";

type SheetTab = { title: string; sheetId: number; rowCount: number; columnCount: number };
type TabsResponse = { spreadsheetId: string; spreadsheetTitle: string; tabs: SheetTab[] };
type RowsResponse = { headers: string[]; rows: string[][]; tab?: string };

interface DashboardListPanelProps {
  listId: DashboardListId;
}

/** Keeps a secondary person's fields (spouse, emergency contact…) out of the main Email/Phone slots. */
const SECONDARY_FIELD = /spouse|emergency|guardian|parent|child/i;

/** Vendor form name is "Full Name (First & Last)"; volunteer is just "Name".
 *  The extra `(\s*\(.*\))?` keeps "Business or Organization Name" out. */
const NAME_HEADER = /^(full\s*)?name(\s*\(.*\))?$/i;

const PERSON_COLUMNS: Array<{ label: string; match: RegExp }> = [
  { label: "Full Name", match: NAME_HEADER },
  { label: "Email", match: /email/i },
  { label: "Phone Number", match: /phone/i },
];

/** The few columns each list shows. Bookkeeping columns (Confirmation Sent,
 *  reminders, codes…) stay in the sheet but out of the dashboard. */
const LIST_COLUMNS: Partial<Record<DashboardListId, Array<{ label: string; match: RegExp }>>> = {
  "master-list": [...PERSON_COLUMNS, { label: "Signed up for", match: /^source$/i }, { label: "Paid", match: /^paid$/i }],
  "payment-review-donations": [
    { label: "Full Name", match: NAME_HEADER },
    { label: "Email", match: /email/i },
    { label: "Amount", match: /^amount$/i },
    { label: "Paid", match: /^paid$/i },
  ],
  "master-volunteer": [...PERSON_COLUMNS, { label: "From", match: /^from$/i }],
  "master-vendor": [
    ...PERSON_COLUMNS,
    { label: "Paid", match: /^paid$/i },
    // Approving a vendor (with a Fee) sends the approval email and starts fee reminders.
    { label: "Status", match: /^status$/i },
    { label: "Fee", match: /^fee$/i },
  ],
  "master-newsletter": [
    { label: "Full Name", match: NAME_HEADER },
    { label: "Email", match: /email/i },
    { label: "Strathcona Resident", match: /strathcona/i },
  ],
  "form-log": [
    { label: "Date", match: /^timestamp$/i },
    { label: "Form", match: /^form$/i },
    { label: "Full Name", match: NAME_HEADER },
    { label: "Email", match: /email/i },
    { label: "Details", match: /^details$/i },
    { label: "From", match: /^from$/i },
  ],
  "master-registrations": [
    { label: "Date", match: /^timestamp$/i },
    { label: "Full Name", match: NAME_HEADER },
    { label: "Email", match: /email/i },
    { label: "Event", match: /^event$/i },
  ],
  "master-contact": [
    { label: "Date", match: /^timestamp$/i },
    { label: "Full Name", match: NAME_HEADER },
    { label: "Email", match: /email/i },
    { label: "Message", match: /^message$/i },
  ],
};

const VENDOR_STATUSES = ["Pending", "Approved", "Declined"];

/** Lists that can be narrowed by where people came from: the column, and what a blank cell means. */
const FROM_FILTER: Partial<Record<DashboardListId, { column: RegExp; label: string; blank: string }>> = {
  "master-volunteer": { column: /^from$/i, label: "Volunteered through", blank: "Website" },
  "master-registrations": { column: /^event$/i, label: "Event", blank: "" },
};

/** Narrows headers down to a curated set, in that set's order, skipping any
 * header excluded (e.g. "Spouse's Email" shouldn't win the "Email" slot). */
function canonicalColumns(
  headers: string[],
  canonical: Array<{ label: string; match: RegExp }>,
  exclude: RegExp,
): Array<{ index: number; label: string }> {
  return canonical.flatMap(({ label, match }) => {
    const index = headers.findIndex((h) => {
      const trimmed = h.trim();
      return match.test(trimmed) && !exclude.test(trimmed);
    });
    return index === -1 ? [] : [{ index, label }];
  });
}

/** Which sheet columns to show, and under what label. */
function getVisibleColumns(
  listId: DashboardListId,
  headers: string[],
): Array<{ index: number; label: string }> {
  const canonical = LIST_COLUMNS[listId];
  if (canonical) return canonicalColumns(headers, canonical, SECONDARY_FIELD);
  return headers
    .map((label, index) => ({ index, label }))
    .filter(({ label }) => !/^(confirmation sent|reminder count|last reminder|reminder round|stop reminders|approval sent)$/i.test(label.trim()));
}

/** "Imported" is bookkeeping from the old sheets, and status-like columns read
 *  better empty than as a column of dashes. */
function displayCell(_header: string, value: string | undefined): React.ReactNode {
  const v = (value ?? "").trim();
  if (!v || /^imported$/i.test(v)) return <EmptyCell />;
  return v;
}

/** A light dash, so an empty cell reads as "nothing here" rather than a gap. */
function EmptyCell() {
  return (
    <span className="dash-empty-cell" aria-label="Empty">
      –
    </span>
  );
}

/** Lists where a row can be marked paid (stops payment reminders). */
const PAYABLE_LISTS: DashboardListId[] = ["master-list", "payment-review-donations", "master-vendor"];

function cellByHeader(headers: string[], row: string[], name: string): string {
  const i = headers.findIndex((h) => h.trim().toLowerCase() === name.toLowerCase());
  return i < 0 ? "" : String(row[i] ?? "").trim();
}

function noMatchHint(tab: string, query: string, dateFrom: string, dateTo: string): string {
  const q = query.trim();
  const range =
    dateFrom && dateTo
      ? `between ${formatIsoDayLabel(dateFrom)} and ${formatIsoDayLabel(dateTo)}`
      : dateFrom
        ? `from ${formatIsoDayLabel(dateFrom)} onward`
        : dateTo
          ? `through ${formatIsoDayLabel(dateTo)}`
          : "";
  if (q && range) return `Nothing in “${tab}” matches “${q}” ${range}.`;
  if (q) return `Nothing in “${tab}” matches “${q}”.`;
  if (range) return `Nothing in “${tab}” was registered ${range}.`;
  return `Nothing in “${tab}” matches.`;
}

export function DashboardListPanel({ listId }: DashboardListPanelProps) {
  const meta = listMeta(listId);

  const [tabsInfo, setTabsInfo] = useState<TabsResponse | null>(null);
  const [tabsError, setTabsError] = useState("");

  // Loaded once — powers every list's "Open in Sheets" link.
  useEffect(() => {
    let cancelled = false;
    setTabsInfo(null);
    setTabsError("");
    fetch("/api/dashboard/sheet-tabs")
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return;
        if (data.error) setTabsError(data.error);
        else setTabsInfo(data);
      })
      .catch(() => {
        if (!cancelled) setTabsError("Failed to load the spreadsheet's tab list.");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const activeTab = meta.sheetTab;

  const [rows, setRows] = useState<RowsResponse | null>(null);
  const [rowsError, setRowsError] = useState("");
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState("");
  const [fromFilter, setFromFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [dateOpen, setDateOpen] = useState(false);
  const datePopoverRef = useRef<HTMLDivElement>(null);
  const dateFilterBtnRef = useRef<HTMLButtonElement>(null);

  const loadRows = useCallback((tab: string, signal?: { cancelled: boolean }) => {
    setLoading(true);
    setRowsError("");
    fetch(
      `/api/dashboard/sheet-rows?tab=${encodeURIComponent(tab)}`,
      { cache: "no-store" },
    )
      .then((res) => res.json())
      .then((data) => {
        if (signal?.cancelled) return;
        if (data.error) setRowsError(data.error);
        else setRows({ ...data, tab });
      })
      .catch(() => {
        if (!signal?.cancelled) setRowsError("Failed to load this tab's rows.");
      })
      .finally(() => {
        if (!signal?.cancelled) setLoading(false);
      });
  }, []);

  useEffect(() => {
    setQuery("");
    setFromFilter("");
    setDateFrom("");
    setDateTo("");
    setDateOpen(false);
    if (!activeTab) {
      setRows(null);
      return;
    }
    const signal = { cancelled: false };
    loadRows(activeTab, signal);
    return () => {
      signal.cancelled = true;
    };
  }, [activeTab, loadRows]);

  const dateColumnIndex = useMemo(
    () => findDateColumnIndex(rows?.headers ?? []),
    [rows],
  );
  const dateFilterActive = Boolean(dateFrom || dateTo);

  // "From" chips: where people came from (volunteer form, event), with counts.
  const fromConfig = FROM_FILTER[listId];
  const fromColumnIndex = useMemo(
    () => (fromConfig ? (rows?.headers ?? []).findIndex((h) => fromConfig.column.test(h.trim())) : -1),
    [rows, fromConfig],
  );
  const fromValue = useCallback(
    (row: string[]) => (String(row[fromColumnIndex] ?? "").trim() || fromConfig?.blank || ""),
    [fromColumnIndex, fromConfig],
  );
  const fromOptions = useMemo(() => {
    if (!rows || fromColumnIndex < 0) return [];
    const counts = new Map<string, number>();
    for (const row of rows.rows) {
      const v = fromValue(row);
      if (v) counts.set(v, (counts.get(v) ?? 0) + 1);
    }
    return [...counts].sort((a, b) => b[1] - a[1]);
  }, [rows, fromColumnIndex, fromValue]);

  useEffect(() => {
    if (!dateOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setDateOpen(false);
    };
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      if (datePopoverRef.current?.contains(target) || dateFilterBtnRef.current?.contains(target)) {
        return;
      }
      const active = document.activeElement;
      if (
        active instanceof HTMLInputElement &&
        active.type === "date" &&
        datePopoverRef.current?.contains(active)
      ) {
        return;
      }
      setDateOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [dateOpen]);

  // rowNumber is 1-indexed and includes the header row, matching the Sheets API range.
  const visibleRows = useMemo(() => {
    if (!rows) return [];
    const withRowNumbers = rows.rows.map((row, i) => ({ row, rowNumber: i + 2 }));
    const q = query.trim().toLowerCase();
    const matching = withRowNumbers.filter(({ row }) => {
      if (fromFilter && fromValue(row) !== fromFilter) return false;
      if (dateFilterActive && !rowMatchesDateFilter(row, dateColumnIndex, dateFrom, dateTo)) {
        return false;
      }
      if (!q) return true;
      const textMatch = row.some((cell) => (cell ?? "").toLowerCase().includes(q));
      if (textMatch) return true;
      return row.some((cell) => cellMatchesDateQuery(cell ?? "", query.trim()));
    });
    // Newest first; rows without a date go to the end, in sheet order.
    if (dateColumnIndex < 0) return matching;
    const time = (row: string[]) => parseSheetDate(row[dateColumnIndex] ?? "")?.getTime() ?? -Infinity;
    return matching
      .map((r) => ({ ...r, t: time(r.row) }))
      .sort((a, b) => (b.t === a.t ? a.rowNumber - b.rowNumber : b.t - a.t))
      .map(({ row, rowNumber }) => ({ row, rowNumber }));
  }, [rows, query, dateFrom, dateTo, dateColumnIndex, dateFilterActive, fromFilter, fromValue]);

  const [editingRow, setEditingRow] = useState<number | null>(null);
  const [editValues, setEditValues] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  /** Rows marked paid this visit, so the button can offer Undo. */
  const [justPaid, setJustPaid] = useState<Set<number>>(new Set());
  const [payingRow, setPayingRow] = useState<number | null>(null);

  const setPaid = async (rowNumber: number, paid: boolean) => {
    if (!rows || !activeTab) return;
    const paidCol = rows.headers.findIndex((h) => /^paid$/i.test(h.trim()));
    if (paidCol < 0) return;
    setPayingRow(rowNumber);
    setSaveError("");
    try {
      const res = await fetch("/api/dashboard/signups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "paid", tab: activeTab, rowNumber, paid }),
      });
      const d = (await res.json()) as { error?: string };
      if (!res.ok || d.error) throw new Error(d.error || "Couldn't save");
      setRows((prev) =>
        prev
          ? {
              ...prev,
              rows: prev.rows.map((r, i) => {
                if (i + 2 !== rowNumber) return r;
                const next = [...r];
                next[paidCol] = paid ? "Paid" : "";
                return next;
              }),
            }
          : prev,
      );
      setJustPaid((prev) => {
        const next = new Set(prev);
        if (paid) next.add(rowNumber);
        else next.delete(rowNumber);
        return next;
      });
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Couldn't save");
    } finally {
      setPayingRow(null);
    }
  };

  const [addingNewRow, setAddingNewRow] = useState(false);
  const [newRowValues, setNewRowValues] = useState<string[]>([]);
  const [savingNewRow, setSavingNewRow] = useState(false);
  const tableWrapRef = useRef<HTMLDivElement>(null);

  const startEdit = (rowNumber: number, row: string[]) => {
    setEditingRow(rowNumber);
    setEditValues([...row]);
    setSaveError("");
  };

  const cancelEdit = () => {
    setEditingRow(null);
    setEditValues([]);
    setSaveError("");
  };

  const saveEdit = async () => {
    if (editingRow === null || !activeTab) return;
    setSaving(true);
    setSaveError("");
    try {
      const res = await fetch("/api/dashboard/sheet-rows", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tab: activeTab, rowNumber: editingRow, values: editValues }),
      });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || "Failed to save");

      setRows((prev) =>
        prev
          ? {
              ...prev,
              rows: prev.rows.map((r, i) => (i + 2 === editingRow ? editValues : r)),
            }
          : prev,
      );
      setEditingRow(null);
      setEditValues([]);
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  // Adding is a two-step, local-first flow: "Add row" just opens a draft
  // pinned at the top of the table — nothing is written to the sheet until
  // the user confirms with the tick. Only then does it land in the sheet
  // (at the bottom, its natural position) and the draft disappears.
  const beginAddRow = () => {
    if (!rows) return;
    setNewRowValues(rows.headers.map((h) => defaultValueForDateHeader(h)));
    setAddingNewRow(true);
    setSaveError("");
    tableWrapRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  };

  const cancelNewRow = () => {
    setAddingNewRow(false);
    setNewRowValues([]);
    setSaveError("");
  };

  const saveNewRow = async () => {
    if (!activeTab) return;
    setSavingNewRow(true);
    setSaveError("");
    try {
      const res = await fetch("/api/dashboard/sheet-rows", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tab: activeTab, values: newRowValues }),
      });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || "Failed to add row");

      setAddingNewRow(false);
      setNewRowValues([]);
      loadRows(activeTab);
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Failed to add row");
    } finally {
      setSavingNewRow(false);
    }
  };

  const sheetGid = tabsInfo?.tabs.find((t) => t.title === activeTab)?.sheetId;
  const openInSheetsHref =
    tabsInfo && activeTab
      ? `https://docs.google.com/spreadsheets/d/${tabsInfo.spreadsheetId}/edit${
          sheetGid !== undefined ? `#gid=${sheetGid}` : ""
        }`
      : undefined;

  const exportCsv = () => {
    if (!rows) return;
    const escape = (cell: string) => `"${(cell ?? "").replace(/"/g, '""')}"`;
    const csv = [
      visibleColumns.map((col) => col.label),
      ...visibleRows.map((v) => visibleColumns.map((col) => v.row[col.index])),
    ]
      .map((r) => r.map(escape).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${activeTab || meta.title}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const emailColumns = useMemo(
    () => (rows?.headers ?? []).map((h) => /email/i.test(h)),
    [rows],
  );

  const visibleColumns = useMemo(
    () => getVisibleColumns(listId, rows?.headers ?? []),
    [listId, rows],
  );

  const errorMessage = rowsError || tabsError;
  // Only blank the list on the first load of a tab; a refresh keeps the rows on screen.
  const initialLoading = loading && rows?.tab !== activeTab;
  const needsGoogleConnect = /no google account connected/i.test(errorMessage);
  const needsEnvConfig = /is not configured/i.test(errorMessage);

  return (
    <div className="dash-panel">
      <header className="dash-panel-head">
        <div className="dash-panel-heading">
          <h2 className="dash-panel-title">{meta.title}</h2>
          {rows && rows.rows.length > 0 && (
            <p className="dash-panel-sub">
              {rows.rows.length} {rows.rows.length === 1 ? "person" : "people"}
            </p>
          )}
          {fromConfig && fromOptions.length > 1 && (
            <div className="dash-panel-tabs">
              <Segmented
                label={fromConfig.label}
                value={fromFilter}
                onChange={setFromFilter}
                options={[
                  { value: "", label: `All ${rows?.rows.length ?? 0}` },
                  ...fromOptions.map(([v, n]) => ({ value: v, label: `${v} ${n}` })),
                ]}
              />
            </div>
          )}
        </div>
        <div className="dash-panel-actions">
          {/* Grouped into rows (dash-actions-row is `display:contents` on
              desktop). On small screens search gets its own row and the
              other actions shrink to icon buttons; nothing is hidden. */}
          <div className="dash-actions-row dash-actions-row--search">
            <div className="dash-search-wrap">
              <Search size={15} aria-hidden />
              <input
                type="search"
                className="dash-search-input"
                placeholder="Search this list…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                disabled={!rows || rows.rows.length === 0}
              />
              <button
                ref={dateFilterBtnRef}
                type="button"
                className={`dash-search-filter focus-ring-light${dateFilterActive ? " dash-search-filter--on" : ""}${dateOpen ? " dash-search-filter--open" : ""}`}
                aria-label={
                  dateFilterActive
                    ? `Date filter, ${dateFrom && dateTo ? `${formatIsoDayLabel(dateFrom)} to ${formatIsoDayLabel(dateTo)}` : dateFrom ? `from ${formatIsoDayLabel(dateFrom)}` : `through ${formatIsoDayLabel(dateTo)}`}. Change dates.`
                    : "Filter by date"
                }
                aria-expanded={dateOpen}
                aria-haspopup="dialog"
                aria-controls="dash-date-popover"
                disabled={!rows || rows.rows.length === 0}
                onClick={() => setDateOpen((open) => !open)}
              >
                <ListFilter size={15} aria-hidden />
                {dateFilterActive && <span className="dash-search-filter-dot" />}
              </button>
              {dateOpen && (
                <div
                  ref={datePopoverRef}
                  id="dash-date-popover"
                  className="dash-date-popover"
                  role="dialog"
                  aria-label="Filter by date"
                >
                  <p className="dash-date-popover-title">Date range</p>
                  <label className="dash-date-field">
                    <span className="dash-date-label">From</span>
                    <input
                      type="date"
                      className="dash-date-input"
                      value={dateFrom}
                      onChange={(e) => setDateFrom(e.target.value)}
                    />
                  </label>
                  <label className="dash-date-field">
                    <span className="dash-date-label">To</span>
                    <input
                      type="date"
                      className="dash-date-input"
                      value={dateTo}
                      onChange={(e) => setDateTo(e.target.value)}
                    />
                  </label>
                  <button
                    type="button"
                    className="dash-date-clear focus-ring-light"
                    onClick={() => {
                      setDateFrom("");
                      setDateTo("");
                    }}
                    disabled={!dateFilterActive}
                  >
                    Clear dates
                  </button>
                </div>
              )}
            </div>
          </div>
          <div className="dash-actions-row dash-actions-row--primary">
            <button
              type="button"
              className="dash-action-btn focus-ring-light"
              onClick={beginAddRow}
              disabled={!activeTab || !rows || addingNewRow}
              title="Add a new row"
            >
              <Plus size={16} />
              Add row
            </button>
          </div>
          <div className="dash-actions-row dash-actions-row--secondary">
            <button
              type="button"
              className="dash-action-btn focus-ring-light"
              onClick={() => activeTab && loadRows(activeTab)}
              disabled={!activeTab || loading}
              aria-label="Refresh"
            >
              <Busy busy={loading}>
                <RefreshCw size={16} aria-hidden />
                <span className="dash-btn-label">Refresh</span>
              </Busy>
            </button>
            <button
              type="button"
              className="dash-action-btn focus-ring-light"
              onClick={exportCsv}
              disabled={!rows || rows.rows.length === 0}
              aria-label="Download as a spreadsheet"
            >
              <Download size={16} aria-hidden />
              <span className="dash-btn-label">Download</span>
            </button>
            <a
              className="dash-action-btn focus-ring-light"
              href={openInSheetsHref ?? undefined}
              target="_blank"
              rel="noreferrer"
              onClick={(e) => {
                if (!openInSheetsHref) e.preventDefault();
              }}
              aria-disabled={!openInSheetsHref}
              aria-label="Open in Google Sheets"
            >
              <ExternalLink size={16} aria-hidden />
              <span className="dash-btn-label">Open in Sheets</span>
            </a>
          </div>
        </div>

      </header>

      {listId === "form-log" && <PushToggle />}

      {initialLoading && (
        <div className="dash-empty">
          <p className="dash-muted">Loading…</p>
        </div>
      )}

      {!initialLoading && errorMessage && (
        <div className="dash-empty">
          <p className="dash-empty-title">This list couldn&rsquo;t load</p>
          {needsGoogleConnect ? (
            <>
              <p className="dash-empty-text">The dashboard needs to be signed in to Google to read the spreadsheet.</p>
              <a className="dash-primary-btn focus-ring-light" href="/api/google/connect">
                Sign in to Google
              </a>
            </>
          ) : needsEnvConfig ? (
            <p className="dash-empty-text">The spreadsheet isn&rsquo;t set up on the website yet. Ask whoever manages the website to finish the setup.</p>
          ) : (
            <>
              <p className="dash-empty-text">{errorMessage}</p>
              <button type="button" className="dash-action-btn focus-ring-light" onClick={() => activeTab && loadRows(activeTab)}>
                Try again
              </button>
            </>
          )}
        </div>
      )}

      {!initialLoading && !errorMessage && !activeTab && (
        <div className="dash-empty">
          <p>No sheet tab available yet.</p>
        </div>
      )}

      {!initialLoading && !errorMessage && activeTab && rows && rows.rows.length === 0 && !addingNewRow && (
        <div className="dash-empty">
          <p className="dash-empty-title">{listId === "form-log" ? "No forms yet" : "Nobody here yet"}</p>
          <p className="dash-muted">
            {listId === "form-log"
              ? "Every form that comes in from now on (website forms and event Google Forms) will show up here."
              : "People will show up here as they sign up."}
          </p>
        </div>
      )}

      {!initialLoading && !errorMessage && rows && rows.rows.length > 0 && visibleRows.length === 0 && !addingNewRow && (
        <div className="dash-empty">
          <p>No matches.</p>
          <p className="dash-muted">{noMatchHint(activeTab || meta.title, query, dateFrom, dateTo)}</p>
        </div>
      )}

      {!initialLoading && !errorMessage && rows && (visibleRows.length > 0 || addingNewRow) && (
        <div className="dash-table-wrap" ref={tableWrapRef}>
          {saveError && <p className="dash-error dash-save-error">{saveError}</p>}
          <table className="dash-table">
            <thead>
              <tr>
                {visibleColumns.map((col) => (
                  <th key={col.index}>{col.label || `Column ${col.index + 1}`}</th>
                ))}
                <th className="dash-th-actions" aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {addingNewRow && (
                <tr className="dash-row-new">
                  {visibleColumns.map((col) => {
                    const isTimestamp = isTimestampHeader(rows.headers[col.index] ?? "");
                    return (
                      <td key={col.index}>
                        {isTimestamp ? (
                          newRowValues[col.index] || ""
                        ) : (
                          <input
                            className="dash-cell-input focus-ring-light"
                            placeholder={col.label}
                            value={newRowValues[col.index] ?? ""}
                            onChange={(e) =>
                              setNewRowValues((prev) => {
                                const next = [...prev];
                                next[col.index] = e.target.value;
                                return next;
                              })
                            }
                          />
                        )}
                      </td>
                    );
                  })}
                  <td className="dash-row-actions">
                    <button
                      type="button"
                      className="dash-icon-action focus-ring-light"
                      onClick={saveNewRow}
                      disabled={savingNewRow}
                      title="Save"
                    >
                      <Check size={15} />
                    </button>
                    <button
                      type="button"
                      className="dash-icon-action focus-ring-light"
                      onClick={cancelNewRow}
                      disabled={savingNewRow}
                      title="Cancel"
                    >
                      <X size={15} />
                    </button>
                  </td>
                </tr>
              )}
              {visibleRows.map(({ row, rowNumber }) => {
                const isEditing = editingRow === rowNumber;
                return (
                  <tr key={rowNumber}>
                    {visibleColumns.map((col) => {
                      const isTimestamp = isTimestampHeader(rows.headers[col.index] ?? "");
                      return isEditing ? (
                        <td key={col.index}>
                          {isTimestamp ? (
                            row[col.index] || ""
                          ) : listId === "master-vendor" && /^status$/i.test((rows.headers[col.index] ?? "").trim()) ? (
                            <select
                              className="dash-select focus-ring-light"
                              aria-label="Vendor status"
                              value={editValues[col.index] || "Pending"}
                              onChange={(e) =>
                                setEditValues((prev) => {
                                  const next = [...prev];
                                  next[col.index] = e.target.value;
                                  return next;
                                })
                              }
                            >
                              {VENDOR_STATUSES.map((v) => (
                                <option key={v} value={v}>
                                  {v}
                                </option>
                              ))}
                            </select>
                          ) : (
                            <input
                              className="dash-cell-input focus-ring-light"
                              value={editValues[col.index] ?? ""}
                              onChange={(e) =>
                                setEditValues((prev) => {
                                  const next = [...prev];
                                  next[col.index] = e.target.value;
                                  return next;
                                })
                              }
                            />
                          )}
                        </td>
                      ) : (
                        <td key={col.index} className={emailColumns[col.index] ? "dash-cell-email" : undefined}>
                          {listId === "master-vendor" && /^status$/i.test((rows.headers[col.index] ?? "").trim()) ? (
                            row[col.index] && !/^pending$/i.test(row[col.index].trim()) ? (
                              <span className="dash-status-cell">
                                <span className={`dash-status-chip dash-status-chip--${row[col.index].trim().toLowerCase()}`}>
                                  {row[col.index]}
                                </span>
                                {/^approved$/i.test(row[col.index].trim()) && (
                                  <span className="dash-cell-note">
                                    {cellByHeader(rows.headers, row, "Approval Sent")
                                      ? "Approval email sent"
                                      : cellByHeader(rows.headers, row, "Fee")
                                        ? "Approval email goes out on the next run"
                                        : "Add a fee to send the approval email"}
                                  </span>
                                )}
                              </span>
                            ) : (
                              <EmptyCell />
                            )
                          ) : PAYABLE_LISTS.includes(listId) && /^paid$/i.test((rows.headers[col.index] ?? "").trim()) ? (
                            /^paid$/i.test((row[col.index] ?? "").trim()) ? (
                              <span className="dash-status-cell dash-status-cell--row">
                                <span className="dash-status-chip dash-status-chip--approved">Paid</span>
                                {justPaid.has(rowNumber) && (
                                  <button
                                    type="button"
                                    className="dash-text-btn focus-ring-light"
                                    onClick={() => setPaid(rowNumber, false)}
                                    disabled={payingRow === rowNumber}
                                  >
                                    Undo
                                  </button>
                                )}
                              </span>
                            ) : listId !== "master-list" || /^membership$/i.test(cellByHeader(rows.headers, row, "Source")) ? (
                              <button
                                type="button"
                                className="dash-action-btn dash-action-btn--small focus-ring-light"
                                onClick={() => setPaid(rowNumber, true)}
                                disabled={payingRow !== null}
                              >
                                <Busy busy={payingRow === rowNumber}>Mark paid</Busy>
                              </button>
                            ) : (
                              <EmptyCell />
                            )
                          ) : (
                            displayCell(rows.headers[col.index] ?? "", row[col.index])
                          )}
                        </td>
                      );
                    })}
                    <td className="dash-row-actions">
                      {isEditing ? (
                        <>
                          <button
                            type="button"
                            className="dash-icon-action focus-ring-light"
                            onClick={saveEdit}
                            disabled={saving}
                            title="Save"
                          >
                            <Check size={15} />
                          </button>
                          <button
                            type="button"
                            className="dash-icon-action focus-ring-light"
                            onClick={cancelEdit}
                            disabled={saving}
                            title="Cancel"
                          >
                            <X size={15} />
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          className="dash-icon-action focus-ring-light"
                          onClick={() => startEdit(rowNumber, row)}
                          title="Edit row"
                        >
                          <Pencil size={15} />
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* The total is in the header; the footer only appears while searching/filtering. */}
      {!initialLoading && !errorMessage && rows && visibleRows.length > 0 && visibleRows.length !== rows.rows.length && (
        <p className="dash-row-count">
          {visibleRows.length}
          {visibleRows.length !== rows.rows.length ? ` of ${rows.rows.length}` : ""} row
          {rows.rows.length === 1 ? "" : "s"}
          {dateFilterActive
            ? dateFrom && dateTo
              ? ` · ${formatIsoDayLabel(dateFrom)} to ${formatIsoDayLabel(dateTo)}`
              : dateFrom
                ? ` · from ${formatIsoDayLabel(dateFrom)}`
                : ` · through ${formatIsoDayLabel(dateTo)}`
            : ""}
        </p>
      )}
    </div>
  );
}
