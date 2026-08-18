/**
 * Reads Interac e-Transfer mail from every connected inbox that receives
 * payments (payment@asosc.ca, support@asosc.ca, africanssocietyofsc@gmail.com)
 * via gmail.readonly, then marks matching Membership / Donations / Vendors
 * rows as Paid.
 *
 * Routing uses the Interac message field first (DONATION / MEMBERSHIP / VENDOR).
 * Without a keyword, the first unpaid row with that Reply-To email wins, in
 * membership → donations → vendors order. Amount is never used to pick a sheet.
 * The Payments Match dialog lists Master List. Staff pick Members, Donations,
 * or Vendors under the name: that sheet's row is marked Paid, or a new row is
 * created if they are not on it yet.
 * Matching uses Gmail internalDate (when the notice arrived in the inbox) against
 * the form row Timestamp / Entry Date, so an older transfer pairs with the
 * signup from that time rather than the next unpaid row in the sheet.
 */

import { listGoogleAccounts } from "@/lib/google-oauth";
import {
  appendSheetRow,
  ensurePaidColumn,
  ensureSheetTab,
  getAccessTokenForAccount,
  getSheetValues,
  updateSheetCell,
  updateSheetRow,
} from "@/lib/google-sheets";
import { resolveDashboardSheetId, type DashboardSheetSource } from "@/lib/dashboard-sheets";
import { findDateColumnIndex, formatTimestamp, parseSheetDate, defaultValueForDateHeader } from "@/lib/sheet-dates";

const INBOUND_FROM = "notify@payments.interac.ca";
const DEFAULT_INTERAC_INBOXES = [
  "payment@asosc.ca",
  "support@asosc.ca",
  "africanssocietyofsc@gmail.com",
];
const LOG_TAB = "Interac Log";
const LOG_HEADERS = [
  "Logged At",
  "Inbox",
  "Gmail Message ID",
  "Payer Name",
  "Payer Email",
  "Amount",
  "Message",
  "Matched",
  "Status",
];

export type InteracKind = "membership" | "donation" | "vendor" | "master";

const PAYABLE_KINDS = ["membership", "donation", "vendor"] as const;

export type InteracRunResult = {
  scanned: number;
  matched: number;
  unmatched: number;
  skipped: number;
  errors: string[];
  results: Array<{
    email: string;
    amount: number | "";
    matched: string;
    status: string;
  }>;
};

export type GmailHeader = { name?: string; value?: string };
export type GmailPart = {
  mimeType?: string;
  filename?: string;
  body?: { data?: string; attachmentId?: string; size?: number };
  parts?: GmailPart[];
};
export type GmailMessage = {
  id: string;
  internalDate?: string | number;
  payload?: { headers?: GmailHeader[]; mimeType?: string; body?: { data?: string }; parts?: GmailPart[] };
};

export type GmailSession = { email: string; accessToken: string };

type ParsedTransfer = {
  messageId: string;
  inbox: string;
  email: string;
  name: string;
  amount: number | "";
  message: string;
  reference: string;
  keyword: string;
  dkim: "pass" | "fail" | "unknown";
  subject: string;
  /** When the Interac notice landed in Gmail, not when the matcher ran. */
  receivedAt: Date | null;
};

function pick(text: string, re: RegExp): string {
  const m = text.match(re);
  return m?.[1]?.trim() ?? "";
}

function extractEmail(headerValue: string): string {
  const m = String(headerValue || "").match(/<([^>]+)>/);
  return (m ? m[1] : String(headerValue || "").trim()).toLowerCase();
}

function displayName(headerValue: string): string {
  const m = String(headerValue || "")
    .trim()
    .match(/^"?([^"<]+?)"?\s*</);
  const name = m ? m[1].trim() : "";
  if (!name || name.includes("@")) return "";
  return name;
}

export function header(headers: GmailHeader[] | undefined, name: string): string {
  return headers?.find((h) => h.name?.toLowerCase() === name.toLowerCase())?.value ?? "";
}

export function decodeB64Url(data: string): string {
  const padded = data.replace(/-/g, "+").replace(/_/g, "/") + "==".slice(0, (4 - (data.length % 4)) % 4);
  return Buffer.from(padded, "base64").toString("utf8");
}

export function walkByMime(part: GmailPart | undefined, mimeType: string): string {
  if (!part) return "";
  if (part.mimeType === mimeType && part.body?.data) return decodeB64Url(part.body.data);
  for (const child of part.parts ?? []) {
    const found = walkByMime(child, mimeType);
    if (found) return found;
  }
  return "";
}

export function walkPlainText(part: GmailPart | undefined): string {
  const plain = walkByMime(part, "text/plain");
  if (plain) return plain;
  const html = walkByMime(part, "text/html");
  if (!html) return "";
  return html.replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ");
}

function findKeyword(message: string): string {
  const lower = message.toLowerCase();
  return ["member", "membership", "vendor", "donation", "donate"]
    .filter((k) => lower.includes(k))
    .join(", ");
}

function kindFromKeyword(keyword: string): InteracKind | null {
  const lower = keyword.toLowerCase();
  if (/\bdonat/.test(lower)) return "donation";
  if (/\bmember/.test(lower)) return "membership";
  if (/\bvendor/.test(lower)) return "vendor";
  return null;
}

function dkimStatus(authResults: string): ParsedTransfer["dkim"] {
  if (!authResults) return "unknown";
  if (/\bdkim\s*=\s*pass\b/i.test(authResults)) return "pass";
  if (/\bdkim\s*=\s*fail\b/i.test(authResults)) return "fail";
  return "unknown";
}

function receivedAtFromMessage(msg: GmailMessage, body = ""): Date | null {
  const internal = Number(msg.internalDate);
  if (Number.isFinite(internal) && internal > 0) return new Date(internal);

  const dateHeader = header(msg.payload?.headers, "Date");
  if (dateHeader) {
    const parsed = new Date(dateHeader);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }

  const transferDate = pick(body, /^\s*Date:\s*(.+)$/m);
  if (transferDate) {
    return parseSheetDate(transferDate) ?? (Number.isNaN(Date.parse(transferDate)) ? null : new Date(transferDate));
  }
  return null;
}

function parseInbound(msg: GmailMessage, inbox: string): ParsedTransfer {
  const headers = msg.payload?.headers ?? [];
  const body = walkPlainText(msg.payload).replace(/\r\n/g, "\n");
  const subject = header(headers, "Subject");
  const msgMatch = body.match(/^\s*Message:\s*\n([\s\S]*?)(?:\n\s*\n|\nFAQ:)/m);
  const message = msgMatch ? msgMatch[1].trim() : "";
  const amountRaw =
    pick(body, /^\s*Amount:\s*\$([\d,]+\.\d{2})/m) ||
    pick(body, /Funds Deposited!\s*\n\s*\$([\d,]+\.\d{2})/) ||
    pick(subject, /\$([\d,]+\.\d{2})/);
  const amount = amountRaw ? Number(amountRaw.replace(/,/g, "")) : "";

  return {
    messageId: msg.id,
    inbox: inbox.trim().toLowerCase(),
    email: extractEmail(header(headers, "Reply-To")),
    name:
      pick(body, /^\s*Sent From:\s*(.+)$/m) || displayName(header(headers, "Reply-To")),
    amount: Number.isFinite(amount) ? amount : "",
    message,
    reference: pick(body, /^\s*Reference Number:\s*(\S+)/m),
    keyword: findKeyword(message),
    dkim: dkimStatus(header(headers, "Authentication-Results")),
    subject,
    receivedAt: receivedAtFromMessage(msg, body),
  };
}

async function ensureLogHeaders(accessToken: string, spreadsheetId: string): Promise<string[]> {
  await ensureSheetTab(accessToken, spreadsheetId, LOG_TAB);
  const values = await getSheetValues(accessToken, spreadsheetId, LOG_TAB);
  const headers = [...(values[0] ?? [])];
  if (headers.length === 0) {
    await appendSheetRow(accessToken, spreadsheetId, LOG_TAB, LOG_HEADERS);
    return [...LOG_HEADERS];
  }
  const missing = LOG_HEADERS.filter((h) => headerIndex(headers, h) < 0);
  if (missing.length === 0) return headers;
  const next = [...headers, ...missing];
  await updateSheetRow(accessToken, spreadsheetId, LOG_TAB, 1, next);
  return next;
}

function logFieldMap(transfer: ParsedTransfer, matched: string, status: string): Record<string, string> {
  return {
    "logged at": transfer.receivedAt ? formatTimestamp(transfer.receivedAt) : "",
    "inbox": transfer.inbox,
    "gmail message id": transfer.messageId,
    "payer name": transfer.name,
    "payer email": transfer.email,
    "amount": transfer.amount === "" ? "" : String(transfer.amount),
    "message": transfer.message,
    "matched": matched,
    "status": status,
  };
}

function sessionsForInbox(sessions: GmailSession[], inbox: string): GmailSession[] {
  const wanted = inbox.trim().toLowerCase();
  if (!wanted) return sessions;
  const hit = sessions.filter((s) => s.email.toLowerCase() === wanted);
  const rest = sessions.filter((s) => s.email.toLowerCase() !== wanted);
  return hit.length > 0 ? [...hit, ...rest] : sessions;
}

async function overlayInboxArrival(
  sheetsToken: string,
  sessions: GmailSession[],
  spreadsheetId: string,
  headers: string[],
  rows: string[][],
): Promise<string[][]> {
  const idCol = headerIndex(headers, "gmail message id");
  const dateCol = headerIndex(headers, "logged at");
  const nameCol = headerIndex(headers, "payer name");
  const inboxCol = headerIndex(headers, "inbox");
  if (idCol < 0 || sessions.length === 0) return rows;

  const next = rows.map((row) => [...row]);
  await Promise.all(
    next.map(async (row, i) => {
      const messageId = String(row[idCol] ?? "").trim();
      if (!messageId) return;
      const storedInbox = inboxCol >= 0 ? String(row[inboxCol] ?? "").trim() : "";
      const needsInbox = inboxCol >= 0 && !storedInbox;
      const needsName = nameCol >= 0 && !hasRealName(String(row[nameCol] ?? ""));
      const needsDate = dateCol >= 0 && !String(row[dateCol] ?? "").trim();
      if (!needsDate && !needsName && !needsInbox) return;

      for (const session of sessionsForInbox(sessions, storedInbox)) {
        try {
          const format = needsName ? "full" : "metadata";
          const raw = (await gmailFetch(
            session.accessToken,
            `messages/${encodeURIComponent(messageId)}?format=${format}${format === "metadata" ? "&metadataHeaders=Date&fields=id,internalDate,payload/headers" : ""}`,
          )) as GmailMessage;
          const transfer = parseInbound(raw, session.email);
          if (inboxCol >= 0 && !storedInbox) {
            while (row.length <= inboxCol) row.push("");
            row[inboxCol] = session.email;
            await updateSheetCell(sheetsToken, spreadsheetId, LOG_TAB, i + 2, inboxCol + 1, session.email);
          }
          if (dateCol >= 0 && transfer.receivedAt) {
            const label = formatTimestamp(transfer.receivedAt);
            if (String(row[dateCol] ?? "").trim() !== label) {
              row[dateCol] = label;
              await updateSheetCell(sheetsToken, spreadsheetId, LOG_TAB, i + 2, dateCol + 1, label);
            }
          }
          if (needsName) {
            const name = transfer.name || "—";
            while (row.length <= nameCol) row.push("");
            row[nameCol] = name;
            await updateSheetCell(sheetsToken, spreadsheetId, LOG_TAB, i + 2, nameCol + 1, name);
          }
          return;
        } catch {
          // Try the next connected inbox; this message may live in another mailbox.
        }
      }
    }),
  );
  return next;
}

export async function gmailFetch(accessToken: string, path: string) {
  const response = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/${path}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });
  const payload = (await response.json()) as { error?: { message?: string }; messages?: Array<{ id: string }>; [k: string]: unknown };
  if (!response.ok) {
    throw new Error(payload.error?.message || `Gmail API failed (${response.status})`);
  }
  return payload;
}

function configuredInteracInboxes(): string[] {
  const fromEnv = [process.env.INTERAC_GMAIL_ACCOUNTS, process.env.INTERAC_GMAIL_ACCOUNT]
    .flatMap((value) => (value ?? "").split(/[,;]/))
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
  return [...new Set([...fromEnv, ...DEFAULT_INTERAC_INBOXES.map((email) => email.toLowerCase())])];
}

function accountHasGmail(account: { scope?: string }) {
  const scope = account.scope ?? "";
  return scope.includes("gmail") || scope.includes("mail.google.com");
}

async function tokenForSheets() {
  return getAccessTokenForAccount();
}

/** Gmail's messages.list caps each page at 500 and a single call without a
 * pageToken only returns its default page (100 unless maxResults says otherwise) —
 * a plain single call with a small maxResults silently drops anything past that
 * page with no error, which is how "recent transfers aren't showing up" happens
 * once a mailbox has more matching mail than one page. Page through everything. */
export async function listAllGmailMessageIds(
  accessToken: string,
  query: string,
  maxPages = 20,
): Promise<string[]> {
  const ids: string[] = [];
  let pageToken: string | undefined;
  for (let page = 0; page < maxPages; page++) {
    const path = `messages?q=${encodeURIComponent(query)}&maxResults=500${pageToken ? `&pageToken=${pageToken}` : ""}`;
    const list = (await gmailFetch(accessToken, path)) as { messages?: Array<{ id: string }>; nextPageToken?: string };
    ids.push(...(list.messages ?? []).map((m) => m.id));
    if (!list.nextPageToken) break;
    pageToken = list.nextPageToken;
  }
  return ids;
}

export async function gmailInboxes(): Promise<GmailSession[]> {
  const accounts = await listGoogleAccounts();
  if (accounts.length === 0) {
    throw new Error(
      "No Google account is connected. Sign in at /upgrade, then open /api/google/connect once for each inbox that receives Interac e-Transfers (payment@asosc.ca, support@asosc.ca, and africanssocietyofsc@gmail.com).",
    );
  }

  const wanted = new Set(configuredInteracInboxes());
  const named = accounts.filter((account) => wanted.has(account.email.toLowerCase()));
  const otherGmail = accounts.filter(
    (account) => !wanted.has(account.email.toLowerCase()) && accountHasGmail(account),
  );
  const targets = [
    ...new Map([...named, ...otherGmail].map((account) => [account.email.toLowerCase(), account])).values(),
  ];

  const sessions: GmailSession[] = [];
  const errors: string[] = [];
  for (const account of targets) {
    try {
      sessions.push(await getAccessTokenForAccount(account.email));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      errors.push(`${account.email}: ${message}`);
    }
  }

  if (sessions.length === 0) {
    throw new Error(
      errors.join("; ") ||
        "No Google account with Gmail access is connected. Open /api/google/connect with payment@asosc.ca, support@asosc.ca, and africanssocietyofsc@gmail.com.",
    );
  }
  return sessions;
}

export function headerIndex(headers: string[], ...names: string[]): number {
  const lowered = headers.map((h) => h.trim().toLowerCase());
  for (const name of names) {
    const i = lowered.indexOf(name.toLowerCase());
    if (i !== -1) return i;
  }
  return -1;
}

function hasRealName(value: string): boolean {
  const v = value.trim();
  return Boolean(v) && v !== "—";
}

export function isPaid(value: string): boolean {
  return value.trim().toLowerCase() === "paid";
}

function isNumericId(value: string): boolean {
  return /^\d+$/.test(value.trim());
}

function isWpformsImportCell(value: string): boolean {
  const v = value.trim();
  return /wpforms-entries|entry_id=/i.test(v) || isNumericId(v);
}

function personLabel(sheet: PayableSheet, row: string[]): string {
  const raw = sheet.nameCol >= 0 ? String(row[sheet.nameCol] ?? "").trim() : "";
  const email = sheet.emailCols.map((c) => String(row[c] ?? "").trim()).find(Boolean) ?? "";
  if (raw && !isWpformsImportCell(raw)) return raw;
  return email || raw;
}

export type PayableSheet = {
  label: string;
  spreadsheetId: string;
  tab: string;
  headers: string[];
  rows: string[][];
  emailCols: number[];
  paidCol: number;
  nameCol: number;
  phoneCol: number;
  dateCol: number;
  entryIdCol: number;
};

async function loadPayableSheet(opts: {
  accessToken: string;
  spreadsheetId: string;
  tab: string;
  emailHeaders: string[];
  nameHeaders: string[];
  label: string;
  /** Master List is a roster, not a payment sheet — skip adding PAID OR NOT. */
  requirePaid?: boolean;
}): Promise<PayableSheet | null> {
  if (!opts.spreadsheetId) return null;
  try {
    if (opts.requirePaid !== false) {
      await ensurePaidColumn(opts.accessToken, opts.spreadsheetId, opts.tab);
    }
    const values = await getSheetValues(opts.accessToken, opts.spreadsheetId, opts.tab);
    const [headers = [], ...rows] = values;
    const emailCols = opts.emailHeaders
      .map((name) => headerIndex(headers, name))
      .filter((i) => i >= 0);
    const paidCol = headerIndex(headers, "paid or not");
    const nameCol = headerIndex(headers, ...opts.nameHeaders);
    const phoneCol = headerIndex(headers, "phone number", "donor phone", "phone");
    const dateCol = findDateColumnIndex(headers);
    const entryIdCol = headerIndex(headers, "entry id");
    if (emailCols.length === 0) return null;
    if (opts.requirePaid !== false && paidCol < 0) return null;
    return {
      label: opts.label,
      spreadsheetId: opts.spreadsheetId,
      tab: opts.tab,
      headers,
      rows,
      emailCols,
      paidCol,
      nameCol,
      phoneCol,
      dateCol,
      entryIdCol,
    };
  } catch {
    return null;
  }
}

/** Sign-up after the Interac notice still counts if they paid first, then submitted. */
const SIGNUP_AFTER_ARRIVAL_MS = 12 * 60 * 60 * 1000;

function rowSignupTime(sheet: PayableSheet, row: string[]): number | null {
  if (sheet.dateCol < 0) return null;
  return parseSheetDate(String(row[sheet.dateCol] ?? ""))?.getTime() ?? null;
}

function isLegacyImportRow(sheet: PayableSheet, row: string[]): boolean {
  if (rowSignupTime(sheet, row) != null) return false;
  const entry = sheet.entryIdCol >= 0 ? String(row[sheet.entryIdCol] ?? "") : "";
  if (/wpforms-entries|entry_id=/i.test(entry) || isNumericId(entry)) return true;
  const name = sheet.nameCol >= 0 ? String(row[sheet.nameCol] ?? "").trim() : "";
  return isNumericId(name);
}

function findPersonRow(sheet: PayableSheet, email: string, name: string): number {
  const em = email.trim().toLowerCase();
  const nm = name.trim().toLowerCase();
  let emailUnpaid = -1;
  let emailAny = -1;
  let nameUnpaid = -1;
  let nameAny = -1;
  for (let r = 0; r < sheet.rows.length; r++) {
    const row = sheet.rows[r];
    if (isLegacyImportRow(sheet, row)) continue;
    const emails = sheet.emailCols.map((c) => String(row[c] ?? "").trim().toLowerCase()).filter(Boolean);
    const rowName = sheet.nameCol >= 0 ? String(row[sheet.nameCol] ?? "").trim().toLowerCase() : "";
    const paid = sheet.paidCol >= 0 && isPaid(String(row[sheet.paidCol] ?? ""));
    if (em && emails.includes(em)) {
      if (!paid && emailUnpaid < 0) emailUnpaid = r;
      if (emailAny < 0) emailAny = r;
    } else if (nm && rowName === nm) {
      if (!paid && nameUnpaid < 0) nameUnpaid = r;
      if (nameAny < 0) nameAny = r;
    }
  }
  if (emailUnpaid >= 0) return emailUnpaid;
  if (emailAny >= 0) return emailAny;
  if (nameUnpaid >= 0) return nameUnpaid;
  return nameAny;
}

function nextEntryId(sheet: PayableSheet): string {
  if (sheet.entryIdCol < 0) return "1";
  let max = 0;
  for (const row of sheet.rows) {
    const n = Number(row[sheet.entryIdCol]);
    if (Number.isFinite(n) && n > max) max = n;
  }
  return String(max + 1);
}

const SKIP_CREATE_HEADER = /spouse|business|organization|child|emergency|consent|website|booth|electric|water|license|insurance|comment|product|culture|type of vendor|how did you hear|i understand|i agree/i;

function valueForCreatedRow(
  header: string,
  person: { name: string; email: string; phone: string; amount: string },
  entryId: string,
): string {
  const h = header.trim();
  const lower = h.toLowerCase();
  if (lower === "entry id") return entryId;
  if (lower === "paid or not") return "Paid";
  if (lower === "payment method") return "e-Transfer";
  if (lower === "interac email") return person.email;
  if (/\bamount\b/.test(lower)) return person.amount;
  const dated = defaultValueForDateHeader(h);
  if (dated) return dated;
  if (SKIP_CREATE_HEADER.test(lower)) return "";
  if (/\bphone\b/.test(lower)) return person.phone;
  if (/\bemail\b/.test(lower)) return person.email;
  if (/^(full\s*)?name(\s*\(.*\))?$/.test(lower) || lower === "donor name") return person.name;
  return "";
}

async function markOrCreatePaid(
  accessToken: string,
  sheet: PayableSheet,
  person: { name: string; email: string; phone: string; amount: string },
): Promise<{ label: string; added: boolean }> {
  if (sheet.paidCol < 0) throw new Error(`${sheet.label} has no Paid or Not column.`);
  const existing = findPersonRow(sheet, person.email, person.name);
  if (existing >= 0) {
    const row = sheet.rows[existing];
    if (!isPaid(String(row[sheet.paidCol] ?? ""))) {
      await updateSheetCell(
        accessToken,
        sheet.spreadsheetId,
        sheet.tab,
        existing + 2,
        sheet.paidCol + 1,
        "Paid",
      );
      sheet.rows[existing][sheet.paidCol] = "Paid";
    }
    const who = personLabel(sheet, row);
    return { label: `${sheet.label}: ${who || person.email || person.name}`, added: false };
  }

  const entryId = nextEntryId(sheet);
  const values = sheet.headers.map((header) => valueForCreatedRow(header, person, entryId));
  await appendSheetRow(accessToken, sheet.spreadsheetId, sheet.tab, values);
  return { label: `${sheet.label}: ${person.name || person.email} (added)`, added: true };
}

function pickUnpaidRow(
  sheet: PayableSheet,
  payerEmail: string,
  receivedAt: Date | null,
): number {
  const candidates: Array<{ index: number; signedAt: number }> = [];
  for (let r = 0; r < sheet.rows.length; r++) {
    const row = sheet.rows[r];
    const emails = sheet.emailCols
      .map((c) => String(row[c] ?? "").trim().toLowerCase())
      .filter(Boolean);
    if (!emails.includes(payerEmail)) continue;
    if (isPaid(String(row[sheet.paidCol] ?? ""))) continue;
    if (isLegacyImportRow(sheet, row)) continue;
    const signedAt = rowSignupTime(sheet, row);
    if (signedAt == null) continue;
    candidates.push({ index: r, signedAt });
  }
  if (candidates.length === 0) return -1;
  if (!receivedAt) return candidates[0].index;

  const arrival = receivedAt.getTime();
  const beforeOrAround = candidates.filter((c) => c.signedAt <= arrival + SIGNUP_AFTER_ARRIVAL_MS);
  const pool = beforeOrAround.length > 0 ? beforeOrAround : candidates;
  pool.sort((a, b) => Math.abs(a.signedAt - arrival) - Math.abs(b.signedAt - arrival));
  return pool[0].index;
}

async function markPaidIfEmailMatches(
  accessToken: string,
  sheet: PayableSheet,
  transfer: ParsedTransfer,
): Promise<string> {
  if (!transfer.email || sheet.paidCol < 0) return "";
  const r = pickUnpaidRow(sheet, transfer.email, transfer.receivedAt);
  if (r < 0) return "";

  const row = sheet.rows[r];
  const rowNumber = r + 2;
  await updateSheetCell(
    accessToken,
    sheet.spreadsheetId,
    sheet.tab,
    rowNumber,
    sheet.paidCol + 1,
    "Paid",
  );
  sheet.rows[r][sheet.paidCol] = "Paid";
  const who = personLabel(sheet, row);
  if (!transfer.name && who && who.toLowerCase() !== transfer.email && !isWpformsImportCell(who)) {
    transfer.name = who;
  }
  return `${sheet.label}: ${who || transfer.email}`;
}

function optionalSheetId(source: DashboardSheetSource): string {
  try {
    return resolveDashboardSheetId(source);
  } catch {
    return "";
  }
}

function interacLogSheetId(): string {
  return optionalSheetId("interac") || optionalSheetId("donor") || optionalSheetId("membership");
}

export async function loadMatchTargets(accessToken: string): Promise<Record<InteracKind, PayableSheet | null>> {
  const membershipTab = process.env.MEMBERSHIP_SHEET_TAB?.trim() || String(new Date().getFullYear());
  const [membership, donation, vendor, master] = await Promise.all([
    loadPayableSheet({
      accessToken,
      spreadsheetId: optionalSheetId("membership"),
      tab: membershipTab,
      emailHeaders: ["email", "interac email"],
      nameHeaders: ["name"],
      label: "membership",
    }),
    loadPayableSheet({
      accessToken,
      spreadsheetId: optionalSheetId("donor"),
      tab: "Donations",
      emailHeaders: ["donor email", "email"],
      nameHeaders: ["donor name", "name"],
      label: "donation",
    }),
    loadPayableSheet({
      accessToken,
      spreadsheetId: optionalSheetId("vendor"),
      tab: "Vendors",
      emailHeaders: ["email address", "email"],
      nameHeaders: ["full name (first & last)", "name"],
      label: "vendor",
    }),
    loadPayableSheet({
      accessToken,
      spreadsheetId: optionalSheetId("master"),
      tab: "Master List",
      emailHeaders: ["email"],
      nameHeaders: ["name", "full name"],
      label: "master list",
      requirePaid: false,
    }),
  ]);
  return { membership, donation, vendor, master };
}

async function matchTransfer(
  accessToken: string,
  sheets: Record<InteracKind, PayableSheet | null>,
  transfer: ParsedTransfer,
): Promise<string> {
  const forced = kindFromKeyword(transfer.keyword);
  const order: InteracKind[] = forced ? [forced] : [...PAYABLE_KINDS];
  for (const kind of order) {
    const sheet = sheets[kind];
    if (!sheet) continue;
    const hit = await markPaidIfEmailMatches(accessToken, sheet, transfer);
    if (hit) return hit;
  }
  return "";
}

async function loadSeen(
  accessToken: string,
  spreadsheetId: string,
  headers: string[],
): Promise<{ ids: Set<string>; references: Set<string> }> {
  const values = await getSheetValues(accessToken, spreadsheetId, LOG_TAB);
  const rows = values.slice(1);
  const idCol = headerIndex(headers, "gmail message id");
  const inboxCol = headerIndex(headers, "inbox");
  const ids = new Set<string>();
  const references = new Set<string>();
  if (idCol < 0) return { ids, references };
  for (const row of rows) {
    const id = String(row[idCol] ?? "").trim();
    if (!id) continue;
    ids.add(id);
    const inbox = inboxCol >= 0 ? String(row[inboxCol] ?? "").trim().toLowerCase() : "";
    if (inbox) ids.add(`${inbox}::${id}`);
  }
  return { ids, references };
}

function isSeenMessage(ids: Set<string>, inbox: string, messageId: string): boolean {
  const id = messageId.trim();
  if (!id) return true;
  const box = inbox.trim().toLowerCase();
  return ids.has(id) || Boolean(box && ids.has(`${box}::${id}`));
}

async function logResult(
  accessToken: string,
  spreadsheetId: string,
  headers: string[],
  transfer: ParsedTransfer,
  matched: string,
  status: string,
) {
  const fields = logFieldMap(transfer, matched, status);
  const values = headers.map((header) => fields[header.trim().toLowerCase()] ?? "");
  await appendSheetRow(accessToken, spreadsheetId, LOG_TAB, values);
}

export type InteracMatchCandidate = {
  id: string;
  kind: InteracKind;
  rowNumber: number;
  name: string;
  email: string;
  paid: boolean;
  legacy: boolean;
};

function emailsPaidOn(sheets: Record<InteracKind, PayableSheet | null>): Set<string> {
  const paid = new Set<string>();
  for (const kind of PAYABLE_KINDS) {
    const sheet = sheets[kind];
    if (!sheet || sheet.paidCol < 0) continue;
    for (const row of sheet.rows) {
      if (!isPaid(String(row[sheet.paidCol] ?? ""))) continue;
      for (const col of sheet.emailCols) {
        const email = String(row[col] ?? "").trim().toLowerCase();
        if (email) paid.add(email);
      }
    }
  }
  return paid;
}

export async function listInteracMatchCandidates(): Promise<InteracMatchCandidate[]> {
  const { accessToken } = await tokenForSheets();
  const sheets = await loadMatchTargets(accessToken);
  const paidEmails = emailsPaidOn(sheets);
  const out: InteracMatchCandidate[] = [];
  for (const kind of ["master", ...PAYABLE_KINDS] as InteracKind[]) {
    const sheet = sheets[kind];
    if (!sheet) continue;
    for (let r = 0; r < sheet.rows.length; r++) {
      const row = sheet.rows[r];
      const email =
        sheet.emailCols.map((c) => String(row[c] ?? "").trim()).find(Boolean) ?? "";
      const name = personLabel(sheet, row);
      const entry = sheet.entryIdCol >= 0 ? String(row[sheet.entryIdCol] ?? "").trim() : "";
      if (!name && !email) continue;
      const legacy = isLegacyImportRow(sheet, row);
      const paidOnSheet = sheet.paidCol >= 0 && isPaid(String(row[sheet.paidCol] ?? ""));
      out.push({
        id: `${kind}:${r + 2}`,
        kind,
        rowNumber: r + 2,
        name: name || (legacy && isNumericId(entry) ? `WPForms #${entry}` : email),
        email,
        paid: kind === "master" ? paidEmails.has(email.toLowerCase()) : paidOnSheet,
        legacy,
      });
    }
  }
  out.sort(
    (a, b) =>
      Number(a.legacy) - Number(b.legacy) ||
      Number(a.paid) - Number(b.paid) ||
      a.name.localeCompare(b.name),
  );
  return out;
}

async function updateLogMatch(
  accessToken: string,
  spreadsheetId: string,
  messageId: string,
  matched: string,
  status: string,
  name = "",
) {
  const headers = await ensureLogHeaders(accessToken, spreadsheetId);
  const values = await getSheetValues(accessToken, spreadsheetId, LOG_TAB);
  const rows = values.slice(1);
  const idCol = headerIndex(headers, "gmail message id");
  const matchedCol = headerIndex(headers, "matched");
  const statusCol = headerIndex(headers, "status");
  const nameCol = headerIndex(headers, "payer name");
  if (idCol < 0) throw new Error("Interac Log is missing a Gmail Message ID column.");
  const r = rows.findIndex((row) => String(row[idCol] ?? "").trim() === messageId);
  if (r < 0) throw new Error("That e-Transfer is not in the Interac log.");
  const rowNumber = r + 2;
  if (matchedCol >= 0) {
    await updateSheetCell(accessToken, spreadsheetId, LOG_TAB, rowNumber, matchedCol + 1, matched);
  }
  if (statusCol >= 0) {
    await updateSheetCell(accessToken, spreadsheetId, LOG_TAB, rowNumber, statusCol + 1, status);
  }
  if (nameCol >= 0 && name && !hasRealName(String(rows[r][nameCol] ?? ""))) {
    await updateSheetCell(accessToken, spreadsheetId, LOG_TAB, rowNumber, nameCol + 1, name);
  }
}

export async function manualMatchInterac(opts: {
  messageId: string;
  kind: InteracKind;
  rowNumber: number;
  targetKind?: "membership" | "donation" | "vendor";
  amount?: string;
}): Promise<{ matched: string }> {
  const messageId = opts.messageId.trim();
  if (!messageId) throw new Error("Missing Gmail message id.");
  if (!(["master", ...PAYABLE_KINDS] as InteracKind[]).includes(opts.kind)) {
    throw new Error("Pick a person from Master List, Members, Donations, or Vendors.");
  }
  if (!Number.isInteger(opts.rowNumber) || opts.rowNumber < 2) {
    throw new Error("Invalid row.");
  }

  const { accessToken } = await tokenForSheets();
  const sheets = await loadMatchTargets(accessToken);
  const sheet = sheets[opts.kind];
  if (!sheet) throw new Error("That list isn't connected.");
  const r = opts.rowNumber - 2;
  if (r < 0 || r >= sheet.rows.length) throw new Error("That row is gone from the sheet.");

  const row = sheet.rows[r];
  const who = personLabel(sheet, row);
  const email = sheet.emailCols.map((c) => String(row[c] ?? "").trim()).find(Boolean) ?? "";
  const phone = sheet.phoneCol >= 0 ? String(row[sheet.phoneCol] ?? "").trim() : "";

  let matched: string;
  if (opts.kind === "master") {
    if (!opts.targetKind) {
      throw new Error("Choose Members, Donations, or Vendors under their name.");
    }
    const dest = sheets[opts.targetKind];
    if (!dest) throw new Error("That list isn't connected.");
    const hit = await markOrCreatePaid(accessToken, dest, {
      name: who,
      email,
      phone,
      amount: opts.amount?.replace(/[^0-9.]/g, "") ?? "",
    });
    matched = `${hit.label} (manual)`;
  } else {
    if (sheet.paidCol >= 0 && !isPaid(String(row[sheet.paidCol] ?? ""))) {
      await updateSheetCell(
        accessToken,
        sheet.spreadsheetId,
        sheet.tab,
        opts.rowNumber,
        sheet.paidCol + 1,
        "Paid",
      );
    }
    matched = `${sheet.label}: ${who || email || messageId} (manual)`;
  }

  const logSheetId = interacLogSheetId();
  if (!logSheetId) throw new Error("Interac log spreadsheet is not configured.");
  await updateLogMatch(
    accessToken,
    logSheetId,
    messageId,
    matched,
    "Matched — manual",
    who && who.toLowerCase() !== email.toLowerCase() ? who : "",
  );
  return { matched };
}

export type InteracLog = {
  headers: string[];
  rows: string[][];
  spreadsheetId: string;
  tab: string;
};

export async function getInteracLog(): Promise<InteracLog> {
  const { accessToken } = await tokenForSheets();
  const logSheetId = interacLogSheetId();
  if (!logSheetId) {
    return { headers: LOG_HEADERS, rows: [], spreadsheetId: "", tab: LOG_TAB };
  }

  await ensureLogHeaders(accessToken, logSheetId);
  const values = await getSheetValues(accessToken, logSheetId, LOG_TAB);
  if (values.length === 0) {
    return { headers: LOG_HEADERS, rows: [], spreadsheetId: logSheetId, tab: LOG_TAB };
  }

  const [headers = LOG_HEADERS, ...rows] = values;
  let sessions: GmailSession[] = [];
  try {
    sessions = await gmailInboxes();
  } catch {
    sessions = [];
  }
  const dated = await overlayInboxArrival(accessToken, sessions, logSheetId, headers, rows);
  return { headers, rows: [...dated].reverse(), spreadsheetId: logSheetId, tab: LOG_TAB };
}

export async function runInteracPayments(): Promise<InteracRunResult> {
  const { accessToken } = await tokenForSheets();
  const logSheetId = interacLogSheetId();
  if (!logSheetId) {
    throw new Error("INTERAC_LOG_SHEET_ID must be configured for the Interac log.");
  }

  const inboxes = await gmailInboxes();
  const logHeaders = await ensureLogHeaders(accessToken, logSheetId);
  const seen = await loadSeen(accessToken, logSheetId, logHeaders);
  const sheets = await loadMatchTargets(accessToken);
  const transfers: ParsedTransfer[] = [];
  const result: InteracRunResult = {
    scanned: 0,
    matched: 0,
    unmatched: 0,
    skipped: 0,
    errors: [],
    results: [],
  };

  const connected = new Set(inboxes.map((inbox) => inbox.email.toLowerCase()));
  for (const email of DEFAULT_INTERAC_INBOXES) {
    if (!connected.has(email.toLowerCase())) {
      result.errors.push(
        `${email} is not connected. Open /api/google/connect while signed in as that inbox.`,
      );
    }
  }

  for (const inbox of inboxes) {
    try {
      const allIds = await listAllGmailMessageIds(inbox.accessToken, `from:${INBOUND_FROM}`);
      const unseenIds = allIds.filter((id) => !isSeenMessage(seen.ids, inbox.email, id));
      result.scanned += unseenIds.length;

      for (const id of unseenIds) {
        try {
          const raw = await gmailFetch(inbox.accessToken, `messages/${id}?format=full`);
          const transfer = parseInbound(raw as GmailMessage, inbox.email);
          if (transfer.reference && seen.references.has(transfer.reference)) {
            result.skipped += 1;
            continue;
          }
          transfers.push(transfer);
          seen.ids.add(id);
          seen.ids.add(`${inbox.email.toLowerCase()}::${id}`);
          if (transfer.reference) seen.references.add(transfer.reference);
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          result.errors.push(`${inbox.email} ${id}: ${message}`);
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      result.errors.push(`${inbox.email}: ${message}`);
    }
  }

  transfers.sort((a, b) => (a.receivedAt?.getTime() ?? 0) - (b.receivedAt?.getTime() ?? 0));

  for (const transfer of transfers) {
    try {
      if (transfer.dkim === "fail") {
        await logResult(accessToken, logSheetId, logHeaders, transfer, "", "Blocked — failed DKIM");
        result.skipped += 1;
        result.results.push({ email: transfer.email, amount: transfer.amount, matched: "", status: "blocked" });
        continue;
      }
      if (!transfer.email) {
        await logResult(accessToken, logSheetId, logHeaders, transfer, "", "No Reply-To email");
        result.unmatched += 1;
        result.results.push({ email: "", amount: transfer.amount, matched: "", status: "no-email" });
        continue;
      }
      const matched = await matchTransfer(accessToken, sheets, transfer);
      const status = matched ? "Matched" : "Unmatched — no unpaid row for this email";
      await logResult(accessToken, logSheetId, logHeaders, transfer, matched, status);
      if (matched) result.matched += 1;
      else result.unmatched += 1;
      result.results.push({ email: transfer.email, amount: transfer.amount, matched, status });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      result.errors.push(`${transfer.inbox} ${transfer.messageId}: ${message}`);
    }
  }

  return result;
}
