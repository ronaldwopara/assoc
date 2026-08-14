/** Date columns used for registration / payment filtering across dashboard lists. */

export const TIMESTAMP_HEADER = /^(timestamp|entry\s*date|logged\s*at)$/i;
export const DATE_ONLY_HEADER = /^(date|email\s*date)$/i;

const DATE_COLUMN_PRIORITY = [
  /^timestamp$/i,
  /^entry\s*date$/i,
  /^logged\s*at$/i,
  /^date$/i,
  /^email\s*date$/i,
];

const SHEET_TZ = "America/Edmonton";

export function isTimestampHeader(header: string): boolean {
  return TIMESTAMP_HEADER.test(header.trim());
}

function isGenericDateHeader(header: string): boolean {
  const h = header.trim();
  if (!h || isTimestampHeader(h)) return false;
  if (DATE_ONLY_HEADER.test(h)) return true;
  return /\bdate\b/i.test(h) && !/birth|expir|age/i.test(h);
}

export function isDateOnlyHeader(header: string): boolean {
  return isGenericDateHeader(header);
}

/** First matching date column, preferring Timestamp over a generic Date. */
export function findDateColumnIndex(headers: string[]): number {
  for (const match of DATE_COLUMN_PRIORITY) {
    const index = headers.findIndex((header) => match.test(header.trim()));
    if (index !== -1) return index;
  }
  return headers.findIndex(isGenericDateHeader);
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function zonedParts(date: Date): Record<string, number> {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: SHEET_TZ,
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(date);

  const value = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value ?? "0");

  return {
    year: value("year"),
    month: value("month"),
    day: value("day"),
    hour: value("hour") % 24,
    minute: value("minute"),
    second: value("second"),
  };
}

/** Matches this sheet's existing "7/12/2025 1:36:28" convention, in Edmonton time. */
export function formatTimestamp(date: Date = new Date()): string {
  const p = zonedParts(date);
  return `${p.month}/${p.day}/${p.year} ${p.hour}:${pad(p.minute)}:${pad(p.second)}`;
}

/** Finance Income/Expenditure date cells: yyyy-MM-dd in Edmonton time. */
export function formatIsoDate(date: Date = new Date()): string {
  const p = zonedParts(date);
  return `${p.year}-${pad(p.month)}-${pad(p.day)}`;
}

export function defaultValueForDateHeader(header: string, date: Date = new Date()): string {
  if (isTimestampHeader(header)) return formatTimestamp(date);
  if (isDateOnlyHeader(header)) return formatIsoDate(date);
  return "";
}

/**
 * Parse a sheet cell or a typed query into a Date.
 * Handles Google Forms timestamps, ISO dates, Excel serials, and Date.parse fallbacks.
 */
export function parseSheetDate(value: string): Date | null {
  const raw = (value ?? "").trim();
  if (!raw) return null;

  if (/^\d+(\.\d+)?$/.test(raw)) {
    const serial = Number(raw);
    if (serial > 20000 && serial < 80000) {
      const parsed = new Date(Math.round((serial - 25569) * 86400 * 1000));
      if (!Number.isNaN(parsed.getTime())) return parsed;
    }
  }

  const iso = raw.match(
    /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?/,
  );
  if (iso) {
    return new Date(
      Number(iso[1]),
      Number(iso[2]) - 1,
      Number(iso[3]),
      Number(iso[4] ?? 0),
      Number(iso[5] ?? 0),
      Number(iso[6] ?? 0),
    );
  }

  const md = raw.match(
    /^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)?)?/i,
  );
  if (md) {
    let hour = Number(md[4] ?? 0);
    const ampm = (md[7] ?? "").toUpperCase();
    if (ampm === "PM" && hour < 12) hour += 12;
    if (ampm === "AM" && hour === 12) hour = 0;
    return new Date(
      Number(md[3]),
      Number(md[1]) - 1,
      Number(md[2]),
      hour,
      Number(md[5] ?? 0),
      Number(md[6] ?? 0),
    );
  }

  const fallback = new Date(raw);
  return Number.isNaN(fallback.getTime()) ? null : fallback;
}

/** YYYYMMDD integer for calendar-day comparisons (local date, no time). */
export function dateKey(date: Date): number {
  return date.getFullYear() * 10000 + (date.getMonth() + 1) * 100 + date.getDate();
}

export function parseIsoDay(value: string): number | null {
  const match = value.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  return Number(match[1]) * 10000 + Number(match[2]) * 100 + Number(match[3]);
}

export function rowMatchesDateRange(
  cell: string,
  fromIso: string,
  toIso: string,
): boolean {
  if (!fromIso && !toIso) return true;
  const parsed = parseSheetDate(cell);
  if (!parsed) return false;
  const key = dateKey(parsed);
  const from = fromIso ? parseIsoDay(fromIso) : null;
  const to = toIso ? parseIsoDay(toIso) : null;
  const lo = from != null && to != null ? Math.min(from, to) : from;
  const hi = from != null && to != null ? Math.max(from, to) : to;
  if (lo != null && key < lo) return false;
  if (hi != null && key > hi) return false;
  return true;
}

/** Uses the dedicated date column when present; otherwise any cell that parses as a date. */
export function rowMatchesDateFilter(
  row: string[],
  dateColumnIndex: number,
  fromIso: string,
  toIso: string,
): boolean {
  if (!fromIso && !toIso) return true;
  if (dateColumnIndex !== -1) {
    return rowMatchesDateRange(row[dateColumnIndex] ?? "", fromIso, toIso);
  }
  return row.some((cell) => {
    const value = cell ?? "";
    return parseSheetDate(value) !== null && rowMatchesDateRange(value, fromIso, toIso);
  });
}

/** True when a typed search query is itself a date and matches this cell's calendar day. */
export function cellMatchesDateQuery(cell: string, query: string): boolean {
  const queryDate = parseSheetDate(query);
  if (!queryDate) return false;
  const cellDate = parseSheetDate(cell);
  if (!cellDate) return false;
  return dateKey(cellDate) === dateKey(queryDate);
}

export function formatIsoDayLabel(iso: string): string {
  const match = iso.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return iso;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
