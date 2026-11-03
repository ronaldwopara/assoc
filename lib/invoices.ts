/**
 * Invoices, one row each on the master sheet's Invoices tab; the PDF is drawn
 * on demand from that row (nothing stored), in the asosc.ca theme.
 *
 *  - Paid invoices: made for a "Service" e-Transfer (a receipt-style invoice).
 *  - Invoices to pay: written by hand on the dashboard's Invoices page. They
 *    show how to pay, and are marked paid when an e-Transfer quoting the
 *    invoice number arrives (or by hand).
 *
 * Emails are editable automatic emails ("invoice", "invoice-due") with the PDF attached.
 */

import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { appendSheetRow, getAccessTokenForAccount, getSheetValues, updateSheetCell, updateSheetRow } from "@/lib/google-sheets";
import { EMAIL_LOGO_URL, invoiceDueEmail, invoiceEmail } from "@/lib/emails";
import { E_TRANSFER_EMAIL } from "@/lib/payment-links";
import { getCopyOverrides } from "@/lib/email-store";
import { sendEmail } from "@/lib/mailer";
import { MASTER_HEADERS, MASTER_TABS, colIndex, masterSheetId, rowFromFields } from "@/lib/master-sheet";
import { formatTimestamp, parseSheetDate } from "@/lib/sheet-dates";
import { autoSendEnabled } from "@/lib/settings";

export type Invoice = {
  number: string;
  date: string;
  payerName: string;
  payerEmail: string;
  description: string;
  amount: string;
  messageId: string;
  status: string;
  sentAt: string;
  /** yyyy-mm-dd, invoices to pay only. */
  dueDate?: string;
  /** When the money arrived (Paid On column, or the linked Payments row). */
  paidOn?: string;
  reference?: string;
  /** Paid when it came from an e-Transfer, or has a Paid On date. */
  paid: boolean;
};

const ORG = {
  name: "Africans Society of Strathcona County",
  short: "ASOSC",
  email: "support@asosc.ca",
  site: "asosc.ca",
  place: "Strathcona County, Alberta, Canada",
};

// ---------------------------------------------------------------- sheet

type Tab = { headers: string[]; rows: string[][] };

async function loadTab(tab: string): Promise<Tab> {
  const { accessToken } = await getAccessTokenForAccount();
  const [headers = [], ...rows] = await getSheetValues(accessToken, masterSheetId(), tab);
  if (tab === MASTER_TABS.invoices) {
    // Self-heal columns added after the sheet was built (Due Date, Paid On).
    const missing = MASTER_HEADERS.invoices.filter((h) => colIndex(headers, h) < 0);
    if (missing.length) {
      headers.push(...missing);
      await updateSheetRow(accessToken, masterSheetId(), tab, 1, headers);
    }
  }
  return { headers, rows };
}

const cell = (t: Tab, row: string[], col: string) => String(row[colIndex(t.headers, col)] ?? "").trim();

function toInvoice(t: Tab, row: string[]): Invoice {
  return {
    number: cell(t, row, "Invoice Number"),
    date: cell(t, row, "Date"),
    payerName: cell(t, row, "Payer Name"),
    payerEmail: cell(t, row, "Payer Email"),
    description: cell(t, row, "Description"),
    amount: cell(t, row, "Amount"),
    messageId: cell(t, row, "Gmail Message ID"),
    status: cell(t, row, "Status"),
    sentAt: cell(t, row, "Sent At"),
    dueDate: cell(t, row, "Due Date"),
    paidOn: cell(t, row, "Paid On") || undefined,
    paid: Boolean(cell(t, row, "Gmail Message ID") || cell(t, row, "Paid On")),
  };
}

/** INV-<year>-<4 digits>, counting up within the year. */
function nextNumber(invoices: Tab, year: number): string {
  const prefix = `INV-${year}-`;
  let max = 0;
  for (const row of invoices.rows) {
    const n = cell(invoices, row, "Invoice Number");
    if (n.startsWith(prefix)) max = Math.max(max, Number(n.slice(prefix.length)) || 0);
  }
  return `${prefix}${String(max + 1).padStart(4, "0")}`;
}

async function paymentDetails(messageId: string) {
  const payments = await loadTab(MASTER_TABS.payments);
  const index = payments.rows.findIndex((r) => cell(payments, r, "Gmail Message ID") === messageId);
  if (index < 0) return null;
  const row = payments.rows[index];
  return {
    rowNumber: index + 2,
    payments,
    received: cell(payments, row, "Received"),
    name: cell(payments, row, "Payer Name"),
    email: cell(payments, row, "Payer Email"),
    amount: cell(payments, row, "Amount"),
    memo: cell(payments, row, "Memo"),
    reference: cell(payments, row, "Reference"),
    invoiceNumber: cell(payments, row, "Invoice Number"),
  };
}

function longDate(value: string): string {
  const d = parseSheetDate(value);
  return d ? d.toLocaleDateString("en-CA", { dateStyle: "long" }) : value;
}

/** Creates the invoice for a payment (or returns the existing one). */
export async function createInvoiceForPayment(messageId: string): Promise<Invoice> {
  const p = await paymentDetails(messageId);
  if (!p) throw new Error("Payment not found");
  if (p.invoiceNumber) {
    const existing = await getInvoice(p.invoiceNumber);
    if (existing) return existing;
  }
  if (!p.email) throw new Error("This payment has no payer email to invoice");

  const spreadsheetId = masterSheetId();
  const { accessToken } = await getAccessTokenForAccount();
  const invoices = await loadTab(MASTER_TABS.invoices);
  const number = nextNumber(invoices, new Date().getFullYear());
  const invoice: Invoice = {
    number,
    date: formatTimestamp(new Date()),
    payerName: p.name,
    payerEmail: p.email,
    description: p.memo || "Services",
    amount: p.amount,
    messageId,
    status: "Created",
    sentAt: "",
    paid: true,
  };
  await appendSheetRow(
    accessToken,
    spreadsheetId,
    MASTER_TABS.invoices,
    rowFromFields(invoices.headers, {
      "Invoice Number": invoice.number,
      Date: invoice.date,
      "Payer Name": invoice.payerName,
      "Payer Email": invoice.payerEmail,
      Description: invoice.description,
      Amount: invoice.amount,
      "Gmail Message ID": messageId,
      Status: invoice.status,
    }),
  );
  const col = colIndex(p.payments.headers, "Invoice Number");
  if (col >= 0) await updateSheetCell(accessToken, spreadsheetId, MASTER_TABS.payments, p.rowNumber, col + 1, number);
  return { ...invoice, paidOn: p.received, reference: p.reference };
}

export async function getInvoice(number: string): Promise<Invoice | null> {
  const invoices = await loadTab(MASTER_TABS.invoices);
  const row = invoices.rows.find((r) => cell(invoices, r, "Invoice Number") === number);
  if (!row) return null;
  const invoice = toInvoice(invoices, row);
  const p = invoice.messageId ? await paymentDetails(invoice.messageId) : null;
  return { ...invoice, paidOn: invoice.paidOn || p?.received, reference: p?.reference };
}

export async function listInvoices(): Promise<Invoice[]> {
  const invoices = await loadTab(MASTER_TABS.invoices);
  return invoices.rows.filter((r) => cell(invoices, r, "Invoice Number")).map((r) => toInvoice(invoices, r)).reverse();
}

async function setStatus(number: string, status: string) {
  const spreadsheetId = masterSheetId();
  const { accessToken } = await getAccessTokenForAccount();
  const invoices = await loadTab(MASTER_TABS.invoices);
  const index = invoices.rows.findIndex((r) => cell(invoices, r, "Invoice Number") === number);
  if (index < 0) return;
  const statusCol = colIndex(invoices.headers, "Status");
  const sentCol = colIndex(invoices.headers, "Sent At");
  if (statusCol >= 0) await updateSheetCell(accessToken, spreadsheetId, MASTER_TABS.invoices, index + 2, statusCol + 1, status);
  if (sentCol >= 0 && status === "Sent") {
    await updateSheetCell(accessToken, spreadsheetId, MASTER_TABS.invoices, index + 2, sentCol + 1, formatTimestamp(new Date()));
  }
}

export function invoiceFilename(inv: Invoice) {
  return `ASOSC-${inv.number}.pdf`;
}

/** Emails the invoice with its PDF attached and marks it Sent. */
export async function sendInvoice(number: string): Promise<{ to: string }> {
  const invoice = await getInvoice(number);
  if (!invoice) throw new Error("Invoice not found");
  const pdf = await renderInvoicePdf(invoice);
  const overrides = await getCopyOverrides();
  const email = invoice.paid ? invoiceEmail(invoice, overrides) : invoiceDueEmail(invoice, overrides);
  await sendEmail({
    ...email,
    attachments: [{ filename: invoiceFilename(invoice), contentType: "application/pdf", content: pdf }],
  });
  await setStatus(number, "Sent");
  return { to: invoice.payerEmail };
}

export type NewInvoice = { name: string; email: string; description: string; amount: string; dueDate?: string };

/** An invoice written by hand on the dashboard. Unpaid until marked paid or matched to an e-Transfer. */
export async function createManualInvoice(input: NewInvoice): Promise<Invoice> {
  const email = input.email.trim();
  const amount = String(input.amount ?? "").replace(/[^0-9.]/g, "");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Enter a valid email address");
  if (!(Number(amount) > 0)) throw new Error("Enter an amount");
  if (!input.description.trim()) throw new Error("Say what the invoice is for");
  const dueDate = /^\d{4}-\d{2}-\d{2}$/.test(input.dueDate ?? "") ? input.dueDate! : "";

  const spreadsheetId = masterSheetId();
  const { accessToken } = await getAccessTokenForAccount();
  const invoices = await loadTab(MASTER_TABS.invoices);
  const invoice: Invoice = {
    number: nextNumber(invoices, new Date().getFullYear()),
    date: formatTimestamp(new Date()),
    payerName: input.name.trim().slice(0, 200),
    payerEmail: email,
    description: input.description.trim().slice(0, 2000),
    amount: Number(amount).toFixed(2),
    messageId: "",
    status: "Created",
    sentAt: "",
    dueDate,
    paid: false,
  };
  await appendSheetRow(
    accessToken,
    spreadsheetId,
    MASTER_TABS.invoices,
    rowFromFields(invoices.headers, {
      "Invoice Number": invoice.number,
      Date: invoice.date,
      "Payer Name": invoice.payerName,
      "Payer Email": invoice.payerEmail,
      Description: invoice.description,
      Amount: invoice.amount,
      Status: invoice.status,
      "Due Date": dueDate,
    }),
  );
  return invoice;
}

/** A draft invoice for previewing the PDF before it's saved. */
export function draftInvoice(input: NewInvoice): Invoice {
  return {
    number: `INV-${new Date().getFullYear()}-0000`,
    date: formatTimestamp(new Date()),
    payerName: input.name.trim(),
    payerEmail: input.email.trim(),
    description: input.description.trim(),
    amount: String(input.amount ?? "").replace(/[^0-9.]/g, "") || "0",
    messageId: "",
    status: "Draft",
    sentAt: "",
    dueDate: input.dueDate,
    paid: false,
  };
}

/** Mark an invoice paid (or not), optionally recording the e-Transfer that paid it. */
export async function setInvoicePaid(number: string, paid: boolean, payment?: { messageId: string; when: Date }): Promise<void> {
  const spreadsheetId = masterSheetId();
  const { accessToken } = await getAccessTokenForAccount();
  const invoices = await loadTab(MASTER_TABS.invoices);
  const index = invoices.rows.findIndex((r) => cell(invoices, r, "Invoice Number") === number);
  if (index < 0) throw new Error("Invoice not found");
  const writes: Array<[string, string]> = [["Paid On", paid ? formatTimestamp(payment?.when ?? new Date()) : ""]];
  if (payment) writes.push(["Gmail Message ID", payment.messageId]);
  for (const [col, value] of writes) {
    const c = colIndex(invoices.headers, col);
    if (c >= 0) await updateSheetCell(accessToken, spreadsheetId, MASTER_TABS.invoices, index + 2, c + 1, value);
  }
}

const INVOICE_RE = /\bINV\s*-?\s*(\d{4})\s*-?\s*(\d{4,})\b/i;

/** The unpaid invoice an e-Transfer memo quotes ("INV-2026-0003"), if any. */
export async function unpaidInvoiceInMemo(memo: string): Promise<Invoice | null> {
  const m = memo.match(INVOICE_RE);
  if (!m) return null;
  const number = `INV-${m[1]}-${m[2].padStart(4, "0")}`;
  const invoice = await getInvoice(number);
  return invoice && !invoice.paid ? invoice : null;
}

// ---------------------------------------------------------------- PDF

/** Standard PDF fonts only cover Latin-1; fold the rest so pdf-lib doesn't throw. */
function safe(text: string): string {
  return String(text ?? "")
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, "-")
    .replace(/…/g, "...")
    .replace(/[^\x20-\x7E\xA0-\xFF\n]/g, "");
}

function money(value: string): string {
  const n = Number(String(value ?? "").replace(/[^0-9.]/g, ""));
  return Number.isFinite(n) ? `$${n.toFixed(2)}` : "$0.00";
}

const hex = (h: string) => rgb(parseInt(h.slice(1, 3), 16) / 255, parseInt(h.slice(3, 5), 16) / 255, parseInt(h.slice(5, 7), 16) / 255);
const INK = hex("#2f2b28");
const INK_SOFT = hex("#6f6760");
const ORANGE = hex("#f08f3b");
const ORANGE_DARK = hex("#c66518");
const CREAM = hex("#f3e8d8");
const CREAM_LIGHT = hex("#faf5eb");
const LINE = hex("#e2d4bf");
const WHITE = rgb(1, 1, 1);

let logoCache: Uint8Array | null = null;
async function logoBytes(): Promise<Uint8Array | null> {
  if (logoCache) return logoCache;
  try {
    const res = await fetch(EMAIL_LOGO_URL);
    if (!res.ok) return null;
    logoCache = new Uint8Array(await res.arrayBuffer());
    return logoCache;
  } catch {
    return null;
  }
}

function wrap(text: string, font: PDFFont, size: number, width: number): string[] {
  const out: string[] = [];
  for (const para of safe(text).split(/\n/)) {
    let line = "";
    for (const word of para.split(/\s+/).filter(Boolean)) {
      const next = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(next, size) > width && line) {
        out.push(line);
        line = word;
      } else line = next;
    }
    out.push(line);
  }
  return out;
}

export async function renderInvoicePdf(inv: Invoice): Promise<Buffer> {
  const doc = await PDFDocument.create();
  doc.setTitle(`ASOSC invoice ${inv.number}`);
  doc.setAuthor(ORG.name);
  const page: PDFPage = doc.addPage([612, 792]);
  const regular = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const W = 612;
  const M = 48;
  const text = (s: string, x: number, y: number, size: number, font = regular, color = INK) =>
    page.drawText(safe(s), { x, y, size, font, color });
  const right = (s: string, xRight: number, y: number, size: number, font = regular, color = INK) =>
    text(s, xRight - font.widthOfTextAtSize(safe(s), size), y, size, font, color);

  // Page background + header band
  page.drawRectangle({ x: 0, y: 0, width: W, height: 792, color: CREAM_LIGHT });
  page.drawRectangle({ x: 0, y: 792 - 120, width: W, height: 120, color: INK });
  const logo = await logoBytes();
  if (logo) {
    const img = await doc.embedPng(logo);
    page.drawImage(img, { x: M, y: 792 - 98, width: 76, height: 76 });
  }
  text(ORG.name, M + 92, 792 - 54, 15, bold, WHITE);
  text(`${ORG.place}  ·  ${ORG.email}  ·  ${ORG.site}`, M + 92, 792 - 74, 9.5, regular, CREAM);
  right("INVOICE", W - M, 792 - 54, 22, bold, ORANGE);

  // Invoice meta + PAID stamp
  let y = 792 - 168;
  const meta: Array<[string, string]> = [
    ["Invoice number", inv.number],
    ["Date issued", longDate(inv.date)],
    inv.paid
      ? ["Payment received", inv.paidOn ? longDate(inv.paidOn) : "-"]
      : ["Due date", inv.dueDate ? longDate(`${inv.dueDate}T12:00:00`) : "On receipt"],
  ];
  text("BILL TO", M, y, 9, bold, INK_SOFT);
  meta.forEach(([k, v], i) => {
    right(k.toUpperCase(), W - M - 150, y - i * 20, 9, bold, INK_SOFT);
    right(v, W - M, y - i * 20, 11, i === 0 ? bold : regular);
  });
  text(inv.payerName || inv.payerEmail, M, y - 18, 13, bold);
  if (inv.payerName) text(inv.payerEmail, M, y - 36, 11, regular, INK_SOFT);

  // PAID stamp (paid invoices only)
  const stampY = y - 88;
  if (inv.paid) {
    page.drawRectangle({ x: M, y: stampY, width: 74, height: 28, borderColor: ORANGE_DARK, borderWidth: 2, color: CREAM_LIGHT, opacity: 1 });
    text("PAID", M + 15, stampY + 8, 15, bold, ORANGE_DARK);
  }

  // Line items table
  y = stampY - 40;
  page.drawRectangle({ x: M, y: y - 8, width: W - 2 * M, height: 28, color: CREAM });
  text("DESCRIPTION", M + 12, y + 2, 9, bold, INK_SOFT);
  right("AMOUNT", W - M - 12, y + 2, 9, bold, INK_SOFT);
  y -= 30;
  const descLines = wrap(inv.description || "Services", regular, 11, W - 2 * M - 160);
  descLines.forEach((line, i) => text(line, M + 12, y - i * 15, 11));
  right(money(inv.amount), W - M - 12, y, 11, bold);
  y -= Math.max(1, descLines.length) * 15 + 12;
  page.drawLine({ start: { x: M, y }, end: { x: W - M, y }, thickness: 1, color: LINE });

  // Totals
  y -= 24;
  const totals: Array<[string, string, boolean]> = [
    ["Subtotal", money(inv.amount), false],
    ["Total", money(inv.amount), true],
    ...(inv.paid ? [["Paid", `-${money(inv.amount)}`, false] as [string, string, boolean]] : []),
  ];
  totals.forEach(([k, v, strong], i) => {
    right(k, W - M - 120, y - i * 20, 11, strong ? bold : regular, strong ? INK : INK_SOFT);
    right(v, W - M - 12, y - i * 20, 11, strong ? bold : regular);
  });
  y -= totals.length * 20 + 8;
  page.drawRectangle({ x: W - M - 250, y: y - 10, width: 250, height: 32, color: INK });
  text("BALANCE DUE", W - M - 238, y + 1, 10, bold, CREAM);
  right(inv.paid ? "$0.00" : money(inv.amount), W - M - 12, y, 13, bold, ORANGE);

  // Payment details
  y -= 64;
  if (inv.paid) {
    text("PAYMENT", M, y, 9, bold, INK_SOFT);
    text(
      `Paid by Interac e-Transfer${inv.paidOn ? ` on ${longDate(inv.paidOn)}` : ""}${inv.reference ? `  ·  Reference ${inv.reference}` : ""}`,
      M,
      y - 18,
      11,
    );
  } else {
    text("HOW TO PAY", M, y, 9, bold, INK_SOFT);
    text(`Send an Interac e-Transfer to ${E_TRANSFER_EMAIL}`, M, y - 18, 11, bold);
    text(`and type ${inv.number} in the message box so we can match your payment.`, M, y - 34, 11);
  }

  // Footer
  page.drawLine({ start: { x: M, y: 92 }, end: { x: W - M, y: 92 }, thickness: 1, color: LINE });
  text("Thank you for supporting the African community in Strathcona County.", M, 70, 11, bold);
  text(`Questions about this invoice? Email ${ORG.email}.`, M, 52, 10, regular, INK_SOFT);

  return Buffer.from(await doc.save());
}
