/**
 * Reads outgoing Interac debits, vendor invoices, and vendor receipts from the same
 * three inboxes the Payments tab already watches (payment@asosc.ca, support@asosc.ca,
 * africanssocietyofsc@gmail.com) and logs each as a row on the "Expenses" tab.
 *
 * Detection:
 *  - Debits: sender catch@payments.interac.ca, subject says a transfer was
 *    "successfully deposited" or "has accepted your transfer" (Autodeposit
 *    registration mail from the same sender is excluded — not a money movement).
 *  - Invoices/receipts: a small sender allowlist (Square, Meta for Business, Google
 *    Workspace, Stripe/YAMM) plus a generic fallback for one-off vendors whose
 *    subject line starts with "Invoice" or "Receipt" — narrow on purpose so ordinary
 *    conversation threads that merely mention those words aren't swept in.
 *
 * Every captured email is filed as a PDF in Drive: the original attachment if it has
 * one, or (Interac debits never attach a file, and some vendor mail doesn't either) a
 * PDF rendered from the email itself, so there's always a saved copy backing the row.
 */

import { MASTER_HEADERS, MASTER_TABS, masterSheetId } from "@/lib/master-sheet";
import { findOrCreateFolder, uploadDriveFile } from "@/lib/google-drive";
import {
  appendSheetRow,
  ensureSheetTab,
  getAccessTokenForAccount,
  getSheetValues,
  invalidateReadCache,
} from "@/lib/google-sheets";
import {
  gmailFetch,
  gmailInboxes,
  header,
  headerIndex,
  listAllGmailMessageIds,
  walkByMime,
  walkPlainText,
  type GmailMessage,
  type GmailPart,
  type GmailSession,
} from "@/lib/gmail";
import { formatTimestamp } from "@/lib/sheet-dates";
import { renderEmailAsPdf } from "@/lib/pdf-receipt";
import { getSetting, setSetting } from "@/lib/settings";
import { findAmount, pdfText } from "@/lib/expense-amount";

export type ExpenseKind = "debit" | "invoice" | "receipt";

const EXPENSE_TAB = MASTER_TABS.expenses;
const EXPENSE_HEADERS = [...MASTER_HEADERS.expenses];

const DEBIT_FROM = "catch@payments.interac.ca";
const DEBIT_SUBJECT_OK = /successfully deposited|has accepted your transfer/i;
const DEBIT_SUBJECT_SKIP = /autodeposit/i;

const INVOICE_FOLDER = "email_invoice";
const RECEIPT_FOLDER = "email_receipt";

type SenderRule = { kind: "invoice" | "receipt"; label: string; test: RegExp };

const SENDER_RULES: SenderRule[] = [
  { kind: "invoice", label: "Square", test: /messaging\.squareup\.com/i },
  { kind: "receipt", label: "Meta for Business", test: /business-updates\.facebook\.com/i },
  { kind: "invoice", label: "Google Workspace", test: /payments-noreply@google\.com/i },
];

/** Account notices from the same senders that aren't bills or receipts. */
const NOT_A_RECEIPT = /\b(ad was (approved|rejected)|ad (is|has been) (approved|rejected)|added to a business portfolio|test deposit|verify|verification|security|password|sign-?in|policy|update your|welcome)\b/i;

function classifyVendorMail(fromHeader: string, subject: string): "invoice" | "receipt" | null {
  if (NOT_A_RECEIPT.test(subject)) return null;
  for (const rule of SENDER_RULES) {
    if (!rule.test.test(fromHeader)) continue;
    // These senders also send marketing and account notices; only their bills and receipts count.
    if (!/receipt|invoice|payment (received|confirmation)|you (paid|were charged)|charged|billing statement/i.test(subject)) return null;
    return rule.kind;
  }
  if (/^\s*(your\s+)?invoice\b/i.test(subject)) return "invoice";
  if (/^\s*(your\s+)?receipt\b/i.test(subject)) return "receipt";
  return null;
}

function decodeB64UrlToBuffer(data: string): Buffer {
  const padded = data.replace(/-/g, "+").replace(/_/g, "/") + "==".slice(0, (4 - (data.length % 4)) % 4);
  return Buffer.from(padded, "base64");
}

function findAttachmentPart(part: GmailPart | undefined): GmailPart | null {
  if (!part) return null;
  if (part.filename && part.body?.attachmentId) return part;
  for (const child of part.parts ?? []) {
    const found = findAttachmentPart(child);
    if (found) return found;
  }
  return null;
}

function sanitizeFilename(name: string): string {
  return name.replace(/[/\\?%*:|"<>]/g, "-").slice(0, 120) || "email";
}

async function fileEmail(opts: {
  accessToken: string;
  messageId: string;
  msg: GmailMessage;
  folder: "invoice" | "receipt";
  fallbackTitle: string;
}): Promise<{ link: string; pdf?: Uint8Array }> {
  const folderName = opts.folder === "invoice" ? INVOICE_FOLDER : RECEIPT_FOLDER;
  const folderId = await findOrCreateFolder(opts.accessToken, folderName);

  const attachmentPart = findAttachmentPart(opts.msg.payload as GmailPart | undefined);
  if (attachmentPart?.body?.attachmentId) {
    const attachment = (await gmailFetch(
      opts.accessToken,
      `messages/${opts.messageId}/attachments/${attachmentPart.body.attachmentId}`,
    )) as { data?: string };
    if (attachment.data) {
      const bytes = decodeB64UrlToBuffer(attachment.data);
      const filename = sanitizeFilename(attachmentPart.filename || `${opts.messageId}.pdf`);
      const uploaded = await uploadDriveFile(
        opts.accessToken,
        folderId,
        filename,
        attachmentPart.mimeType || "application/octet-stream",
        bytes,
      );
      const isPdf = /pdf/i.test(attachmentPart.mimeType ?? "") || /\.pdf$/i.test(filename);
      return { link: uploaded.webViewLink, pdf: isPdf ? new Uint8Array(bytes) : undefined };
    }
  }

  const headers = opts.msg.payload?.headers;
  const bytes = await renderEmailAsPdf({
    title: opts.fallbackTitle,
    from: header(headers, "From"),
    date: header(headers, "Date"),
    subject: header(headers, "Subject"),
    body: walkPlainText(opts.msg.payload as GmailPart | undefined) || "(no message body)",
  });
  const uploaded = await uploadDriveFile(
    opts.accessToken,
    folderId,
    `${sanitizeFilename(header(headers, "Subject") || opts.messageId)}.pdf`,
    "application/pdf",
    bytes,
  );
  return { link: uploaded.webViewLink };
}

async function ensureExpenseHeaders(accessToken: string, spreadsheetId: string): Promise<string[]> {
  await ensureSheetTab(accessToken, spreadsheetId, EXPENSE_TAB);
  const values = await getSheetValues(accessToken, spreadsheetId, EXPENSE_TAB);
  const headers = [...(values[0] ?? [])];
  if (headers.length === 0) {
    await appendSheetRow(accessToken, spreadsheetId, EXPENSE_TAB, EXPENSE_HEADERS);
    return [...EXPENSE_HEADERS];
  }
  return headers;
}

const IGNORED_KEY = "ignoredExpenseIds";

async function ignoredExpenseIds(): Promise<string[]> {
  try {
    const parsed = JSON.parse((await getSetting(IGNORED_KEY)) || "[]");
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

/**
 * Removes bills/receipts rows (by Gmail message id) and remembers them so the
 * daily capture doesn't add them back. Returns how many rows were removed.
 */
export async function removeExpenses(messageIds: string[]): Promise<number> {
  const ids = new Set(messageIds.filter((id) => /^[A-Za-z0-9_-]{6,64}$/.test(id)));
  if (!ids.size) return 0;
  const { accessToken } = await getAccessTokenForAccount();
  const spreadsheetId = masterSheetId();
  const values = await getSheetValues(accessToken, spreadsheetId, EXPENSE_TAB);
  const idCol = headerIndex(values[0] ?? [], "gmail message id");
  if (idCol < 0) return 0;
  const rowNumbers = values
    .map((row, i) => ({ id: String(row[idCol] ?? "").trim(), n: i + 1 }))
    .filter((r) => r.n > 1 && ids.has(r.id))
    .map((r) => r.n)
    .sort((a, b) => b - a); // bottom first so earlier row numbers don't shift

  await setSetting(IGNORED_KEY, JSON.stringify([...new Set([...(await ignoredExpenseIds()), ...ids])]));
  if (!rowNumbers.length) return 0;

  const meta = (await (
    await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=sheets.properties(sheetId,title)`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
    })
  ).json()) as { sheets?: Array<{ properties: { sheetId: number; title: string } }> };
  const sheetId = meta.sheets?.find((s) => s.properties.title === EXPENSE_TAB)?.properties.sheetId;
  if (sheetId === undefined) throw new Error("Expenses tab not found");
  const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      requests: rowNumbers.map((n) => ({ deleteDimension: { range: { sheetId, dimension: "ROWS", startIndex: n - 1, endIndex: n } } })),
    }),
  });
  if (!res.ok) throw new Error(`Couldn't remove the rows (${res.status})`);
  invalidateReadCache(spreadsheetId, EXPENSE_TAB);
  return rowNumbers.length;
}

export type SuspectExpense = { id: string; loggedAt: string; payee: string; description: string; reason: string };

/** Bills/receipts rows that look like marketing, account notices, payouts or duplicates, for staff to review and remove. */
export async function suspectExpenses(): Promise<SuspectExpense[]> {
  const { accessToken } = await getAccessTokenForAccount();
  const values = await getSheetValues(accessToken, masterSheetId(), EXPENSE_TAB);
  const h = values[0] ?? [];
  const col = (n: string) => headerIndex(h, n);
  const g = (r: string[], n: string) => String(r[col(n)] ?? "").trim();
  const keys = new Map<string, string>();
  const out: SuspectExpense[] = [];
  for (const r of values.slice(1)) {
    if (/^debit$/i.test(g(r, "type"))) continue;
    const description = g(r, "description");
    const inbox = g(r, "inbox");
    const key = `${description.toLowerCase()}|${g(r, "logged at").slice(0, -3)}`;
    const dup = keys.has(key) && keys.get(key) !== inbox;
    if (!keys.has(key)) keys.set(key, inbox);
    const reason = dup
      ? "Same email, logged again from another inbox"
      : NOT_A_RECEIPT.test(description) || /password|login|passkey|reviewing/i.test(description)
        ? "Account notice"
        : /has sent you \$/i.test(description)
          ? "Payout to ASOSC, not a bill"
          : !/receipt|invoice|payment (received|confirmation)|you (paid|were charged)|charged|billing statement|order/i.test(description)
            ? "Marketing or update email"
            : "";
    if (reason) out.push({ id: g(r, "gmail message id"), loggedAt: g(r, "logged at"), payee: g(r, "payee"), description, reason });
  }
  return out;
}

/** subject|minute → inbox, for spotting the same email logged from another inbox. */
async function loadSeenExpenseKeys(accessToken: string, spreadsheetId: string, headers: string[]): Promise<Map<string, string>> {
  const values = await getSheetValues(accessToken, spreadsheetId, EXPENSE_TAB);
  const d = headerIndex(headers, "description");
  const t = headerIndex(headers, "logged at");
  const i = headerIndex(headers, "inbox");
  const keys = new Map<string, string>();
  for (const row of values.slice(1)) {
    const subject = String(row[d] ?? "").trim().toLowerCase();
    const at = String(row[t] ?? "").trim();
    if (subject && at) keys.set(`${subject}|${at.slice(0, -3)}`, String(row[i] ?? "").trim());
  }
  return keys;
}

async function loadSeenExpenseIds(
  accessToken: string,
  spreadsheetId: string,
  headers: string[],
): Promise<Set<string>> {
  const values = await getSheetValues(accessToken, spreadsheetId, EXPENSE_TAB);
  const idCol = headerIndex(headers, "gmail message id");
  // Rows staff removed from the dashboard stay removed (not picked up again from the inbox).
  const seen = new Set<string>(await ignoredExpenseIds());
  if (idCol < 0) return seen;
  for (const row of values.slice(1)) {
    const id = String(row[idCol] ?? "").trim();
    if (id) seen.add(id);
  }
  return seen;
}

async function logExpenseRow(
  accessToken: string,
  spreadsheetId: string,
  headers: string[],
  fields: {
    loggedAt: string;
    inbox: string;
    messageId: string;
    type: ExpenseKind;
    payee: string;
    amount: string;
    description: string;
    reference: string;
    attachmentLink: string;
  },
) {
  const map: Record<string, string> = {
    "logged at": fields.loggedAt,
    inbox: fields.inbox,
    "gmail message id": fields.messageId,
    type: fields.type[0].toUpperCase() + fields.type.slice(1),
    payee: fields.payee,
    amount: fields.amount,
    description: fields.description,
    reference: fields.reference,
    "attachment link": fields.attachmentLink,
  };
  const values = headers.map((h) => map[h.trim().toLowerCase()] ?? "");
  await appendSheetRow(accessToken, spreadsheetId, EXPENSE_TAB, values);
}

function receivedAtOf(msg: GmailMessage): Date {
  const internal = Number(msg.internalDate);
  if (Number.isFinite(internal) && internal > 0) return new Date(internal);
  return new Date();
}

const DEBIT_PATTERNS = [
  /Your \$([\d,]+\.\d{2}) transfer to (.+?) has been successfully deposited/i,
  /^(.+?) has accepted your transfer of \$([\d,]+\.\d{2})/i,
  /The request for \$([\d,]+\.\d{2}) transfer to (.+?) was successfully deposited/i,
];

function parseDebitSubject(subject: string): { amount: string; payee: string } | null {
  for (const [i, re] of DEBIT_PATTERNS.entries()) {
    const m = subject.match(re);
    if (!m) continue;
    if (i === 1) return { amount: m[2], payee: m[1].trim() };
    return { amount: m[1], payee: m[2].trim() };
  }
  return null;
}

export type ExpenseRunResult = {
  scanned: number;
  added: number;
  skipped: number;
  errors: string[];
};

async function captureDebits(
  accessToken: string,
  spreadsheetId: string,
  headers: string[],
  inbox: GmailSession,
  seen: Set<string>,
  result: ExpenseRunResult,
) {
  const ids = await listAllGmailMessageIds(inbox.accessToken, `from:${DEBIT_FROM}`);
  for (const id of ids) {
    if (seen.has(id)) continue;
    result.scanned += 1;
    try {
      const msg = (await gmailFetch(inbox.accessToken, `messages/${id}?format=full`)) as GmailMessage;
      const subject = header(msg.payload?.headers, "Subject");
      if (DEBIT_SUBJECT_SKIP.test(subject) || !DEBIT_SUBJECT_OK.test(subject)) {
        result.skipped += 1;
        continue;
      }
      const parsed = parseDebitSubject(subject);
      const body = walkPlainText(msg.payload as GmailPart | undefined);
      const reference = (body.match(/Reference Number:\s*(\S+)/) ?? [])[1] ?? "";
      const message = (body.match(/Message:\s*\n([\s\S]+?)(?:\n\s*\n|\nFAQ:)/) ?? [])[1]?.trim() ?? "";

      const { link: attachmentLink } = await fileEmail({
        accessToken: inbox.accessToken,
        messageId: id,
        msg,
        folder: "receipt",
        fallbackTitle: "Interac e-Transfer — outgoing",
      });

      await logExpenseRow(accessToken, spreadsheetId, headers, {
        loggedAt: formatTimestamp(receivedAtOf(msg)),
        inbox: inbox.email,
        messageId: id,
        type: "debit",
        payee: parsed?.payee ?? "",
        amount: parsed?.amount.replace(/,/g, "") ?? "",
        description: message || subject,
        reference,
        attachmentLink,
      });
      seen.add(id);
      result.added += 1;
    } catch (error) {
      result.errors.push(`${inbox.email} ${id}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}

async function captureVendorMail(
  accessToken: string,
  spreadsheetId: string,
  headers: string[],
  inbox: GmailSession,
  seen: Set<string>,
  result: ExpenseRunResult,
  seenKeys: Map<string, string>,
) {
  const senderQuery = SENDER_RULES.map((r) => `from:${r.test.source.replace(/\\\./g, ".")}`).join(" OR ");
  const query = `(${senderQuery} OR subject:invoice OR subject:receipt) -from:${DEBIT_FROM}`;
  const ids = await listAllGmailMessageIds(inbox.accessToken, query);
  for (const id of ids) {
    if (seen.has(id)) continue;
    result.scanned += 1;
    try {
      const msg = (await gmailFetch(inbox.accessToken, `messages/${id}?format=full`)) as GmailMessage;
      const fromHeader = header(msg.payload?.headers, "From");
      const subject = header(msg.payload?.headers, "Subject");
      const kind = classifyVendorMail(fromHeader, subject);
      if (!kind) {
        result.skipped += 1;
        continue;
      }

      // The same email reaching two of our inboxes is logged once.
      const dupKey = `${subject.trim().toLowerCase()}|${formatTimestamp(receivedAtOf(msg)).slice(0, -3)}`;
      if (seenKeys.has(dupKey) && seenKeys.get(dupKey) !== inbox.email) {
        result.skipped += 1;
        continue;
      }

      const plain = walkPlainText(msg.payload as GmailPart | undefined);
      const html = walkByMime(msg.payload as GmailPart | undefined, "text/html").replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ");
      let amount = findAmount(`${subject}\n${plain}\n${html}`);
      const payeeMatch = fromHeader.match(/^"?([^"<]+?)"?\s*</);
      const payee = (payeeMatch ? payeeMatch[1] : fromHeader).trim();

      const filed = await fileEmail({
        accessToken: inbox.accessToken,
        messageId: id,
        msg,
        folder: kind,
        fallbackTitle: subject || (kind === "invoice" ? "Invoice" : "Receipt"),
      });
      // Not in the email? Read it off the attached PDF.
      if (!amount && filed.pdf) amount = findAmount(await pdfText(filed.pdf));
      const attachmentLink = filed.link;

      await logExpenseRow(accessToken, spreadsheetId, headers, {
        loggedAt: formatTimestamp(receivedAtOf(msg)),
        inbox: inbox.email,
        messageId: id,
        type: kind,
        payee,
        amount,
        description: subject,
        reference: "",
        attachmentLink,
      });
      seen.add(id);
      seenKeys.set(dupKey, inbox.email);
      result.added += 1;
    } catch (error) {
      result.errors.push(`${inbox.email} ${id}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}

export async function runExpenseCapture(): Promise<ExpenseRunResult> {
  const { accessToken } = await getAccessTokenForAccount();
  const spreadsheetId = masterSheetId();
  const headers = await ensureExpenseHeaders(accessToken, spreadsheetId);
  const seen = await loadSeenExpenseIds(accessToken, spreadsheetId, headers);
  const seenKeys = await loadSeenExpenseKeys(accessToken, spreadsheetId, headers);

  const inboxes = await gmailInboxes();
  const result: ExpenseRunResult = { scanned: 0, added: 0, skipped: 0, errors: [] };

  for (const inbox of inboxes) {
    await captureDebits(accessToken, spreadsheetId, headers, inbox, seen, result);
    await captureVendorMail(accessToken, spreadsheetId, headers, inbox, seen, result, seenKeys);
  }
  return result;
}

export type ExpenseLog = {
  headers: string[];
  rows: string[][];
  spreadsheetId: string;
  tab: string;
};

export async function getExpenseLog(kind?: ExpenseKind): Promise<ExpenseLog> {
  const { accessToken } = await getAccessTokenForAccount();
  const spreadsheetId = masterSheetId();
  const headers = await ensureExpenseHeaders(accessToken, spreadsheetId);
  const values = await getSheetValues(accessToken, spreadsheetId, EXPENSE_TAB);
  const rows = values.slice(1);
  const typeCol = headerIndex(headers, "type");

  const filtered = kind
    ? rows.filter((row) => String(row[typeCol] ?? "").trim().toLowerCase() === kind)
    : rows;

  return { headers, rows: [...filtered].reverse(), spreadsheetId, tab: EXPENSE_TAB };
}
