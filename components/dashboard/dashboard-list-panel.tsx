"use client";

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
  SlidersHorizontal,
  ListFilter,
} from "lucide-react";
import type { DashboardListId } from "@/lib/dashboard-lists";
import { NON_EVENT_TABS, listMeta } from "@/lib/dashboard-lists";
import {
  cellMatchesDateQuery,
  defaultValueForDateHeader,
  findDateColumnIndex,
  formatIsoDayLabel,
  isTimestampHeader,
  rowMatchesDateFilter,
} from "@/lib/sheet-dates";

type SheetTab = { title: string; sheetId: number; rowCount: number; columnCount: number };
type TabsResponse = { spreadsheetId: string; spreadsheetTitle: string; tabs: SheetTab[] };
type RowsResponse = { headers: string[]; rows: string[][] };

interface DashboardListPanelProps {
  listId: DashboardListId;
}

/** Event sign-up forms vary wildly in shape — this maps each one back onto
 * the same four columns every other list shows, so Events doesn't stick out. */
const SECONDARY_FIELD = /spouse|emergency|guardian|parent|child/i;
const EVENTS_CANONICAL_COLUMNS: Array<{ label: string; match: RegExp }> = [
  { label: "Timestamp", match: /^(timestamp|entry\s*date)$/i },
  { label: "Full Name", match: /^(full\s*)?name$/i },
  { label: "Email", match: /email/i },
  { label: "Phone Number", match: /phone/i },
];

/** Vendor form name is "Full Name (First & Last)"; volunteer is just "Name".
 *  The extra `(\s*\(.*\))?` keeps "Business or Organization Name" out. */
const NAME_HEADER = /^(full\s*)?name(\s*\(.*\))?$/i;

/** Members shows the same narrow field set as the Vendors tab — the rest of
 * the membership form's fields (address, age, spouse, etc.) stay hidden here. */
const MEMBERS_CANONICAL_COLUMNS: Array<{ label: string; match: RegExp }> = [
  { label: "Timestamp", match: /^(timestamp|entry\s*date)$/i },
  { label: "Full Name", match: NAME_HEADER },
  { label: "Email", match: /email/i },
  { label: "Phone Number", match: /phone/i },
  { label: "Paid or Not", match: /^paid or not$/i },
];

const VENDORS_CANONICAL_COLUMNS: Array<{ label: string; match: RegExp }> = [
  { label: "Full Name", match: NAME_HEADER },
  { label: "Email", match: /email/i },
  { label: "Phone Number", match: /phone/i },
  { label: "Paid or Not", match: /^paid or not$/i },
];

const VOLUNTEERS_CANONICAL_COLUMNS: Array<{ label: string; match: RegExp }> = [
  { label: "Full Name", match: NAME_HEADER },
  { label: "Email", match: /email/i },
  { label: "Phone Number", match: /phone/i },
];

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

/** Which sheet columns to show, and under what label — full set for every
 * list except Events, Members, Vendors, and Volunteers, which are narrowed. */
function getVisibleColumns(
  listId: DashboardListId,
  headers: string[],
): Array<{ index: number; label: string }> {
  if (listId === "master-events") {
    return canonicalColumns(headers, EVENTS_CANONICAL_COLUMNS, SECONDARY_FIELD);
  }
  if (listId === "master-members") {
    return canonicalColumns(headers, MEMBERS_CANONICAL_COLUMNS, SECONDARY_FIELD);
  }
  if (listId === "master-vendor") {
    return canonicalColumns(headers, VENDORS_CANONICAL_COLUMNS, SECONDARY_FIELD);
  }
  if (listId === "master-volunteer") {
    return canonicalColumns(headers, VOLUNTEERS_CANONICAL_COLUMNS, SECONDARY_FIELD);
  }
  return headers.map((label, index) => ({ index, label }));
}

function emailColumnIndex(headers: string[]): number {
  return headers.findIndex((h) => {
    const trimmed = h.trim();
    return /email/i.test(trimmed) && !SECONDARY_FIELD.test(trimmed);
  });
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

const CURRENT_YEAR = String(new Date().getFullYear());

/** Lists that cross-reference each other by email to show a "Sources" chip column. */
const SOURCE_LISTS: Array<{ id: DashboardListId; label: string; source: string; tab: string }> = [
  { id: "master-list", label: "Master List", source: "master", tab: "Master List" },
  { id: "master-volunteer", label: "Volunteers", source: "volunteer", tab: "Sheet1" },
  { id: "master-vendor", label: "Vendors", source: "vendor", tab: "Vendors" },
  { id: "master-members", label: "Members", source: "membership", tab: CURRENT_YEAR },
];

export function DashboardListPanel({ listId }: DashboardListPanelProps) {
  const meta = listMeta(listId);
  const source = meta.source ?? "master";

  const [tabsInfo, setTabsInfo] = useState<TabsResponse | null>(null);
  const [tabsError, setTabsError] = useState("");
  const [selectedEvent, setSelectedEvent] = useState("");

  // Loaded once per source — powers the Events dropdown and every list's "Open in Sheets" link.
  useEffect(() => {
    let cancelled = false;
    // Clear immediately so a stale tab list from the previous source (e.g. another
    // spreadsheet) can't be used to compute eventTabs/auto-select while this loads.
    setTabsInfo(null);
    setTabsError("");
    fetch(`/api/dashboard/sheet-tabs?source=${encodeURIComponent(source)}`)
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
  }, [source]);

  const eventTabs = useMemo(
    () => (tabsInfo?.tabs ?? []).filter((t) => !NON_EVENT_TABS.has(t.title)),
    [tabsInfo],
  );

  useEffect(() => {
    if (listId === "master-events" && !selectedEvent && eventTabs.length > 0) {
      setSelectedEvent(eventTabs[0].title);
    }
  }, [listId, eventTabs, selectedEvent]);

  const activeTab = listId === "master-events" ? selectedEvent : meta.sheetTab;

  const [rows, setRows] = useState<RowsResponse | null>(null);
  const [rowsError, setRowsError] = useState("");
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [dateOpen, setDateOpen] = useState(false);
  const datePopoverRef = useRef<HTMLDivElement>(null);
  const dateFilterBtnRef = useRef<HTMLButtonElement>(null);
  /** Mobile only — Refresh/Export/Open in Sheets/event-picker live in a
      bottom sheet there instead of a row of buttons; unused on desktop. */
  const [actionsOpen, setActionsOpen] = useState(false);

  const loadRows = useCallback((tab: string, signal?: { cancelled: boolean }) => {
    setLoading(true);
    setRowsError("");
    fetch(
      `/api/dashboard/sheet-rows?tab=${encodeURIComponent(tab)}&source=${encodeURIComponent(source)}`,
      { cache: "no-store" },
    )
      .then((res) => res.json())
      .then((data) => {
        if (signal?.cancelled) return;
        if (data.error) setRowsError(data.error);
        else setRows(data);
      })
      .catch(() => {
        if (!signal?.cancelled) setRowsError("Failed to load this tab's rows.");
      })
      .finally(() => {
        if (!signal?.cancelled) setLoading(false);
      });
  }, [source]);

  useEffect(() => {
    setQuery("");
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

  // Master List, Volunteers, Vendors, and Members cross-reference each other by
  // email to show a "Sources" chip column — which of the other lists this person is also in.
  const showSources = SOURCE_LISTS.some((s) => s.id === listId);
  const [sourceEmailSets, setSourceEmailSets] = useState<Partial<Record<DashboardListId, Set<string>>>>({});

  useEffect(() => {
    if (!showSources) {
      setSourceEmailSets({});
      return;
    }
    let cancelled = false;
    Promise.all(
      SOURCE_LISTS.filter((s) => s.id !== listId).map((s) =>
        fetch(
          `/api/dashboard/sheet-rows?tab=${encodeURIComponent(s.tab)}&source=${encodeURIComponent(s.source)}`,
          { cache: "no-store" },
        )
          .then((res) => res.json())
          .then((data): [DashboardListId, Set<string>] => {
            const emails = new Set<string>();
            const headers: string[] = data?.headers ?? [];
            const emailIdx = emailColumnIndex(headers);
            if (!data.error && emailIdx !== -1) {
              for (const row of (data.rows ?? []) as string[][]) {
                const email = (row[emailIdx] ?? "").trim().toLowerCase();
                if (email) emails.add(email);
              }
            }
            return [s.id, emails];
          })
          .catch((): [DashboardListId, Set<string>] => [s.id, new Set<string>()]),
      ),
    ).then((entries) => {
      if (cancelled) return;
      setSourceEmailSets(Object.fromEntries(entries));
    });
    return () => {
      cancelled = true;
    };
  }, [listId, showSources]);

  const ownEmailColumnIndex = useMemo(() => emailColumnIndex(rows?.headers ?? []), [rows]);

  const sourcesForRow = useCallback(
    (row: string[]): string[] => {
      if (!showSources || ownEmailColumnIndex === -1) return [];
      const email = (row[ownEmailColumnIndex] ?? "").trim().toLowerCase();
      if (!email) return [];
      return SOURCE_LISTS.filter(
        (s) => s.id !== listId && sourceEmailSets[s.id]?.has(email),
      ).map((s) => s.label);
    },
    [showSources, ownEmailColumnIndex, listId, sourceEmailSets],
  );

  // rowNumber is 1-indexed and includes the header row, matching the Sheets API range.
  const visibleRows = useMemo(() => {
    if (!rows) return [];
    const withRowNumbers = rows.rows.map((row, i) => ({ row, rowNumber: i + 2 }));
    const q = query.trim().toLowerCase();
    return withRowNumbers.filter(({ row }) => {
      if (dateFilterActive && !rowMatchesDateFilter(row, dateColumnIndex, dateFrom, dateTo)) {
        return false;
      }
      if (!q) return true;
      const textMatch = row.some((cell) => (cell ?? "").toLowerCase().includes(q));
      if (textMatch) return true;
      return row.some((cell) => cellMatchesDateQuery(cell ?? "", query.trim()));
    });
  }, [rows, query, dateFrom, dateTo, dateColumnIndex, dateFilterActive]);

  const [editingRow, setEditingRow] = useState<number | null>(null);
  const [editValues, setEditValues] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

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
        body: JSON.stringify({ tab: activeTab, rowNumber: editingRow, values: editValues, source }),
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
        body: JSON.stringify({ tab: activeTab, values: newRowValues, source }),
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
      visibleColumns.map((col) => col.label).concat(showSources ? ["Sources"] : []),
      ...visibleRows.map((v) =>
        visibleColumns
          .map((col) => v.row[col.index])
          .concat(showSources ? [sourcesForRow(v.row).join("; ")] : []),
      ),
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
  const needsGoogleConnect = /no google account connected/i.test(errorMessage);
  const needsEnvConfig = /is not configured/i.test(errorMessage);

  return (
    <div className="dash-panel">
      <header className="dash-panel-head">
        <div className="dash-panel-heading">
          <h2 className="dash-panel-title">{meta.title}</h2>
          <p className="dash-panel-sub">
            {activeTab ? (
              <>
                Sheet tab: <span className="dash-mono">{activeTab}</span>
              </>
            ) : (
              "No sheet tab selected."
            )}
          </p>
        </div>
        <div className="dash-panel-actions">
          {/* Grouped into rows (dash-actions-row is `display:contents` on
              desktop, so this nesting is invisible there — see dashboard.css).
              On mobile, search gets its own full-width row, Add row + More
              actions share the next, and everything else (Refresh, Export,
              Open in Sheets, the event picker) moves into a bottom-sheet
              modal behind "More actions". */}
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
            <button
              type="button"
              className="dash-action-btn dash-actions-trigger focus-ring-light"
              onClick={() => setActionsOpen(true)}
            >
              <SlidersHorizontal size={16} />
              More actions
            </button>
          </div>
          <div className="dash-actions-row dash-actions-row--secondary">
            <button
              type="button"
              className="dash-action-btn focus-ring-light"
              onClick={() => activeTab && loadRows(activeTab)}
              disabled={!activeTab || loading}
              title="Refresh from Sheets"
            >
              <RefreshCw size={16} className={loading ? "dash-spin" : undefined} />
              Refresh
            </button>
            {listId === "master-events" && (
              <label className="dash-select-wrap">
                <span className="sr-only">Filter by event</span>
                <select
                  className="dash-select focus-ring-light"
                  value={selectedEvent}
                  onChange={(e) => setSelectedEvent(e.target.value)}
                  disabled={eventTabs.length === 0}
                >
                  {eventTabs.length === 0 && <option value="">No event tabs found</option>}
                  {eventTabs.map((tab) => (
                    <option key={tab.title} value={tab.title}>
                      {tab.title}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <button
              type="button"
              className="dash-action-btn focus-ring-light"
              onClick={exportCsv}
              disabled={!rows || rows.rows.length === 0}
            >
              <Download size={16} />
              Export CSV
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
            >
              <ExternalLink size={16} />
              Open in Sheets
            </a>
          </div>
        </div>

        {/* Mobile-only bottom sheet — see dashboard.css; never shown on
            desktop, where dash-actions-row--secondary above is already
            visible inline. Same actions, restated here as large, fully
            labeled rows (no icon-only controls) so they stay easy to
            recognize for anyone who doesn't parse icons quickly. */}
        <button
          type="button"
          className={`dash-actions-backdrop${actionsOpen ? " dash-actions-backdrop--visible" : ""}`}
          onClick={() => setActionsOpen(false)}
          aria-hidden={!actionsOpen}
          tabIndex={-1}
        />
        <div
          className={`dash-actions-sheet${actionsOpen ? " dash-actions-sheet--open" : ""}`}
          role="dialog"
          aria-modal="true"
          aria-label="List actions"
        >
          <div className="dash-actions-sheet-head">
            <span className="dash-actions-sheet-title">List actions</span>
            <button
              type="button"
              className="dash-icon-btn dash-icon-btn--ink focus-ring-light"
              onClick={() => setActionsOpen(false)}
              aria-label="Close"
            >
              <X size={18} />
            </button>
          </div>
          <div className="dash-actions-sheet-body" onClick={() => setActionsOpen(false)}>
            <button
              type="button"
              className="dash-sheet-action focus-ring-light"
              onClick={() => activeTab && loadRows(activeTab)}
              disabled={!activeTab || loading}
            >
              <RefreshCw size={18} className={loading ? "dash-spin" : undefined} />
              Refresh
            </button>
            {listId === "master-events" && (
              <label className="dash-sheet-select-wrap" onClick={(e) => e.stopPropagation()}>
                <span className="dash-sheet-select-label">Filter by event</span>
                <select
                  className="dash-select focus-ring-light"
                  value={selectedEvent}
                  onChange={(e) => setSelectedEvent(e.target.value)}
                  disabled={eventTabs.length === 0}
                >
                  {eventTabs.length === 0 && <option value="">No event tabs found</option>}
                  {eventTabs.map((tab) => (
                    <option key={tab.title} value={tab.title}>
                      {tab.title}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <button
              type="button"
              className="dash-sheet-action focus-ring-light"
              onClick={exportCsv}
              disabled={!rows || rows.rows.length === 0}
            >
              <Download size={18} />
              Export CSV
            </button>
            <a
              className="dash-sheet-action focus-ring-light"
              href={openInSheetsHref ?? undefined}
              target="_blank"
              rel="noreferrer"
              onClick={(e) => {
                if (!openInSheetsHref) e.preventDefault();
              }}
              aria-disabled={!openInSheetsHref}
            >
              <ExternalLink size={18} />
              Open in Sheets
            </a>
          </div>
        </div>
      </header>

      {loading && (
        <div className="dash-empty">
          <p className="dash-muted">Loading…</p>
        </div>
      )}

      {!loading && errorMessage && (
        <div className="dash-empty">
          <p>Couldn&rsquo;t load this list.</p>
          <p className="dash-muted">{errorMessage}</p>
          {needsEnvConfig && (
            <p className="dash-muted">
              Set the missing variable on Vercel (Production), redeploy, then refresh.
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

      {!loading && !errorMessage && !activeTab && (
        <div className="dash-empty">
          <p>No sheet tab available yet.</p>
        </div>
      )}

      {!loading && !errorMessage && activeTab && rows && rows.rows.length === 0 && !addingNewRow && (
        <div className="dash-empty">
          <p>No rows yet.</p>
          <p className="dash-muted">
            The &ldquo;{activeTab}&rdquo; tab has headers but no submissions.
          </p>
        </div>
      )}

      {!loading && !errorMessage && rows && rows.rows.length > 0 && visibleRows.length === 0 && !addingNewRow && (
        <div className="dash-empty">
          <p>No matches.</p>
          <p className="dash-muted">{noMatchHint(activeTab || meta.title, query, dateFrom, dateTo)}</p>
        </div>
      )}

      {!loading && !errorMessage && rows && (visibleRows.length > 0 || addingNewRow) && (
        <div className="dash-table-wrap" ref={tableWrapRef}>
          {saveError && <p className="dash-error dash-save-error">{saveError}</p>}
          <table className="dash-table">
            <thead>
              <tr>
                {visibleColumns.map((col) => (
                  <th key={col.index}>{col.label || `Column ${col.index + 1}`}</th>
                ))}
                {showSources && <th>Sources</th>}
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
                          newRowValues[col.index] || "—"
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
                  {showSources && <td>—</td>}
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
                            row[col.index] || "—"
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
                          {row[col.index] || "—"}
                        </td>
                      );
                    })}
                    {showSources && (
                      <td>
                        <div className="dash-sources-inner">
                          {sourcesForRow(row).length === 0
                            ? "—"
                            : sourcesForRow(row).map((label) => (
                                <span key={label} className="dash-source-chip">
                                  {label}
                                </span>
                              ))}
                        </div>
                      </td>
                    )}
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

      {!loading && !errorMessage && rows && visibleRows.length > 0 && (
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
