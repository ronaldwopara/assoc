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

import { resolveDashboardSheetId } from "@/lib/dashboard-sheets";
import { findOrCreateFolder, uploadDriveFile } from "@/lib/google-drive";
import {
  appendSheetRow,
  ensureSheetTab,
  getAccessTokenForAccount,
  getSheetValues,
} from "@/lib/google-sheets";
import {
  gmailFetch,
  gmailInboxes,
  header,
  headerIndex,
  listAllGmailMessageIds,
  walkPlainText,
  type GmailMessage,
  type GmailPart,
  type GmailSession,
} from "@/lib/interac-payments";
import { formatTimestamp } from "@/lib/sheet-dates";
import { renderEmailAsPdf } from "@/lib/pdf-receipt";

export type ExpenseKind = "debit" | "invoice" | "receipt";

const EXPENSE_TAB = "Expenses";
const EXPENSE_HEADERS = [
  "Logged At",
  "Inbox",
  "Gmail Message ID",
  "Type",
  "Payee",
  "Amount",
  "Description",
  "Reference",
  "Attachment Link",
];

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

function classifyVendorMail(fromHeader: string, subject: string): "invoice" | "receipt" | null {
  for (const rule of SENDER_RULES) {
    if (rule.test.test(fromHeader)) return rule.kind;
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
}): Promise<string> {
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
      return uploaded.webViewLink;
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
  return uploaded.webViewLink;
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

async function loadSeenExpenseIds(
  accessToken: string,
  spreadsheetId: string,
  headers: string[],
): Promise<Set<string>> {
  const values = await getSheetValues(accessToken, spreadsheetId, EXPENSE_TAB);
  const idCol = headerIndex(headers, "gmail message id");
  const seen = new Set<string>();
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

      const attachmentLink = await fileEmail({
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

      const body = walkPlainText(msg.payload as GmailPart | undefined);
      const amount = (body.match(/\$[\d,]+\.\d{2}/) ?? subject.match(/\$[\d,]+\.\d{2}/) ?? [])[0] ?? "";
      const payeeMatch = fromHeader.match(/^"?([^"<]+?)"?\s*</);
      const payee = (payeeMatch ? payeeMatch[1] : fromHeader).trim();

      const attachmentLink = await fileEmail({
        accessToken: inbox.accessToken,
        messageId: id,
        msg,
        folder: kind,
        fallbackTitle: subject || (kind === "invoice" ? "Invoice" : "Receipt"),
      });

      await logExpenseRow(accessToken, spreadsheetId, headers, {
        loggedAt: formatTimestamp(receivedAtOf(msg)),
        inbox: inbox.email,
        messageId: id,
        type: kind,
        payee,
        amount: amount.replace(/[$,]/g, ""),
        description: subject,
        reference: "",
        attachmentLink,
      });
      seen.add(id);
      result.added += 1;
    } catch (error) {
      result.errors.push(`${inbox.email} ${id}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}

export async function runExpenseCapture(): Promise<ExpenseRunResult> {
  const { accessToken } = await getAccessTokenForAccount();
  const spreadsheetId = resolveDashboardSheetId("interac");
  const headers = await ensureExpenseHeaders(accessToken, spreadsheetId);
  const seen = await loadSeenExpenseIds(accessToken, spreadsheetId, headers);

  const inboxes = await gmailInboxes();
  const result: ExpenseRunResult = { scanned: 0, added: 0, skipped: 0, errors: [] };

  for (const inbox of inboxes) {
    await captureDebits(accessToken, spreadsheetId, headers, inbox, seen, result);
    await captureVendorMail(accessToken, spreadsheetId, headers, inbox, seen, result);
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
  const spreadsheetId = resolveDashboardSheetId("interac");
  const headers = await ensureExpenseHeaders(accessToken, spreadsheetId);
  const values = await getSheetValues(accessToken, spreadsheetId, EXPENSE_TAB);
  const rows = values.slice(1);
  const typeCol = headerIndex(headers, "type");

  const filtered = kind
    ? rows.filter((row) => String(row[typeCol] ?? "").trim().toLowerCase() === kind)
    : rows;

  return { headers, rows: [...filtered].reverse(), spreadsheetId, tab: EXPENSE_TAB };
}
