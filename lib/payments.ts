/**
 * Interac e-Transfer intake → master sheet "Payments" tab.
 *
 * Reads new notices from notify@payments.interac.ca in every connected inbox,
 * decides what each payment is for, marks the matching signup Paid, and logs
 * one row per payment. Deciding the Type, in order:
 *
 *   1. Payment code in the memo (M-1234 → Master List membership row,
 *      D-1234 → Donations row, V-1234 → approved Vendors row). Exact; that row is marked Paid.
 *   2. Memo keyword ("member", "donat", "vendor") sets the Type; the payer's
 *      unpaid signup of that kind (by email) is marked Paid if there is one.
 *   3. Payer email on an unpaid membership / donation / vendor signup —
 *      the most recent one wins and is marked Paid.
 *   4. Otherwise "Service" (gets an invoice).
 *
 * Only notices newer than the latest row already in Payments are processed,
 * so historical payments are never re-tagged or invoiced.
 */

import {
  appendSheetRow,
  getAccessTokenForAccount,
  getSheetValues,
  updateSheetCell,
  updateSheetRow,
} from "@/lib/google-sheets";
import {
  gmailFetch,
  gmailInboxes,
  header,
  isPaid,
  listAllGmailMessageIds,
  walkPlainText,
  type GmailMessage,
} from "@/lib/gmail";
import { MASTER_HEADERS, MASTER_TABS, colIndex, masterSheetId, rowFromFields } from "@/lib/master-sheet";
import { formatTimestamp, parseSheetDate } from "@/lib/sheet-dates";
import { autoPaymentReceived, toFields } from "@/lib/email-dispatch";

const INTERAC_SENDER = "notify@payments.interac.ca";

export const PAYMENT_TYPES = ["Membership", "Donation", "Vendor", "Service", "Blocked"] as const;
export type PaymentType = (typeof PAYMENT_TYPES)[number];

export function isPaymentType(value: unknown): value is PaymentType {
  return typeof value === "string" && (PAYMENT_TYPES as readonly string[]).includes(value);
}

export type Transfer = {
  messageId: string;
  inbox: string;
  email: string;
  name: string;
  amount: string;
  memo: string;
  reference: string;
  dkimFailed: boolean;
  receivedAt: Date;
};

// ---------------------------------------------------------------- parsing

function pick(text: string, re: RegExp): string {
  return text.match(re)?.[1]?.trim() ?? "";
}

function emailFromHeader(value: string): string {
  const m = value.match(/<([^>]+)>/);
  return (m ? m[1] : value).trim().toLowerCase();
}

function nameFromHeader(value: string): string {
  const name = value.trim().match(/^"?([^"<]+?)"?\s*</)?.[1]?.trim() ?? "";
  return name.includes("@") ? "" : name;
}

export function parseTransfer(msg: GmailMessage, inbox: string): Transfer {
  const headers = msg.payload?.headers ?? [];
  const body = walkPlainText(msg.payload).replace(/\r\n/g, "\n");
  const subject = header(headers, "Subject");
  const replyTo = header(headers, "Reply-To");
  const memo = body.match(/^\s*Message:\s*\n([\s\S]*?)(?:\n\s*\n|\nFAQ:)/m)?.[1]?.trim() ?? "";
  const amount = (
    pick(body, /^\s*Amount:\s*\$([\d,]+\.\d{2})/m) ||
    pick(body, /Funds Deposited!\s*\n\s*\$([\d,]+\.\d{2})/) ||
    pick(subject, /\$([\d,]+\.\d{2})/)
  ).replace(/,/g, "");
  const internal = Number(msg.internalDate);

  return {
    messageId: msg.id,
    inbox: inbox.toLowerCase(),
    email: emailFromHeader(replyTo),
    name: pick(body, /^\s*Sent From:\s*(.+)$/m) || nameFromHeader(replyTo),
    amount,
    memo,
    reference: pick(body, /^\s*Reference Number:\s*(\S+)/m),
    dkimFailed: /\bdkim\s*=\s*fail\b/i.test(header(headers, "Authentication-Results")),
    receivedAt: Number.isFinite(internal) && internal > 0 ? new Date(internal) : new Date(),
  };
}

// ---------------------------------------------------------------- sheet state

type Tab = { name: string; headers: string[]; rows: string[][] };

async function loadTab(accessToken: string, spreadsheetId: string, name: string): Promise<Tab> {
  const [headers = [], ...rows] = await getSheetValues(accessToken, spreadsheetId, name);
  return { name, headers, rows };
}

const cell = (tab: Tab, row: string[], col: string) => String(row[colIndex(tab.headers, col)] ?? "").trim();

/** Appends any schema headers missing from the live tab (e.g. a column added after the sheet was built). */
async function ensureHeaders(accessToken: string, spreadsheetId: string, tab: Tab, wanted: readonly string[]) {
  const missing = wanted.filter((h) => colIndex(tab.headers, h) < 0);
  if (missing.length === 0) return;
  tab.headers = [...tab.headers, ...missing];
  await updateSheetRow(accessToken, spreadsheetId, tab.name, 1, tab.headers);
}

type Signup = { tab: Tab; rowIndex: number; type: PaymentType };

/** The signed-up person's name, as shown in the dashboard's "Signed up as" column. */
function describe(s: Signup): string {
  const row = s.tab.rows[s.rowIndex];
  return cell(s.tab, row, "Full Name") || cell(s.tab, row, "Email");
}

// ---------------------------------------------------------------- classification

const CODE_RE = /\b([MDV])\s*-?\s*(\d{4})\b/i;

function typeFromKeyword(memo: string): PaymentType | null {
  const m = memo.toLowerCase();
  if (/member/.test(m)) return "Membership";
  if (/donat/.test(m)) return "Donation";
  if (/vendor|booth/.test(m)) return "Vendor";
  return null;
}

type State = { masterList: Tab; donations: Tab; vendors: Tab };

function isMembershipRow(tab: Tab, row: string[]) {
  return /^membership$/i.test(cell(tab, row, "Source"));
}

function findByCode(state: State, memo: string): Signup | null {
  const m = memo.match(CODE_RE);
  if (!m) return null;
  const letter = m[1].toUpperCase();
  const code = `${letter}-${m[2]}`;
  const tab = letter === "M" ? state.masterList : letter === "D" ? state.donations : state.vendors;
  const rowIndex = tab.rows.findIndex((r) => cell(tab, r, "Payment Code").toUpperCase() === code);
  if (rowIndex < 0) return null;
  return { tab, rowIndex, type: letter === "M" ? "Membership" : letter === "D" ? "Donation" : "Vendor" };
}

/** Most recent unpaid signup for this payer email, optionally limited to one type. */
function findByEmail(state: State, email: string, only?: PaymentType): Signup | null {
  if (!email) return null;
  const candidates: Signup[] = [];
  const scan = (tab: Tab, type: PaymentType, match: (row: string[]) => boolean) => {
    if (only && only !== type) return;
    tab.rows.forEach((row, rowIndex) => {
      if (match(row) && !isPaid(cell(tab, row, "Paid"))) candidates.push({ tab, rowIndex, type });
    });
  };
  const same = (v: string) => v.toLowerCase() === email;
  scan(state.masterList, "Membership", (r) =>
    isMembershipRow(state.masterList, r) &&
    (same(cell(state.masterList, r, "Email")) || same(cell(state.masterList, r, "Interac Email"))),
  );
  scan(state.donations, "Donation", (r) => same(cell(state.donations, r, "Email")));
  scan(state.vendors, "Vendor", (r) => same(cell(state.vendors, r, "Email")));

  const time = (s: Signup) => parseSheetDate(cell(s.tab, s.tab.rows[s.rowIndex], "Timestamp"))?.getTime() ?? 0;
  candidates.sort((a, b) => time(b) - time(a));
  return candidates[0] ?? null;
}

/** type "" = couldn't tell; shown as "Needs a look" for staff to sort out. */
export type Classification = { type: PaymentType | ""; signup: Signup | null; how: string };

export function classify(state: State, t: Transfer): Classification {
  if (t.dkimFailed) return { type: "Blocked", signup: null, how: "failed DKIM check" };

  const byCode = findByCode(state, t.memo);
  if (byCode) return { type: byCode.type, signup: byCode, how: "payment code" };

  const keywordType = typeFromKeyword(t.memo);
  if (keywordType) {
    return { type: keywordType, signup: findByEmail(state, t.email, keywordType), how: "memo keyword" };
  }

  const byEmail = findByEmail(state, t.email);
  if (byEmail) return { type: byEmail.type, signup: byEmail, how: "payer email" };

  return { type: "", signup: null, how: "no code, keyword or signup" };
}

async function markPaid(accessToken: string, spreadsheetId: string, s: Signup, when: Date) {
  const row = s.tab.rows[s.rowIndex];
  const rowNumber = s.rowIndex + 2;
  const paidCol = colIndex(s.tab.headers, "Paid");
  if (paidCol >= 0) {
    await updateSheetCell(accessToken, spreadsheetId, s.tab.name, rowNumber, paidCol + 1, "Paid");
    row[paidCol] = "Paid";
  }
  const dateCol = colIndex(s.tab.headers, "Paid Date");
  if (dateCol >= 0) {
    const value = formatTimestamp(when);
    await updateSheetCell(accessToken, spreadsheetId, s.tab.name, rowNumber, dateCol + 1, value);
    row[dateCol] = value;
  }
}

// ---------------------------------------------------------------- run

export type PaymentRunResult = {
  checked: number;
  logged: number;
  byType: Record<string, number>;
  errors: string[];
  /** Dry run only: what would have been written. */
  preview?: Array<Record<string, string>>;
};

const DAY_MS = 24 * 60 * 60 * 1000;

/** `dryRun` classifies and reports without writing anything to the sheet. */
export async function runPayments({ dryRun = false } = {}): Promise<PaymentRunResult> {
  const spreadsheetId = masterSheetId();
  const { accessToken } = await getAccessTokenForAccount();
  const [payments, masterList, donations, vendors] = await Promise.all([
    loadTab(accessToken, spreadsheetId, MASTER_TABS.payments),
    loadTab(accessToken, spreadsheetId, MASTER_TABS.masterList),
    loadTab(accessToken, spreadsheetId, MASTER_TABS.donations),
    loadTab(accessToken, spreadsheetId, MASTER_TABS.vendors),
  ]);
  if (dryRun) payments.headers = [...MASTER_HEADERS.payments];
  else await ensureHeaders(accessToken, spreadsheetId, payments, MASTER_HEADERS.payments);
  const state: State = { masterList, donations, vendors };

  const seenIds = new Set(payments.rows.map((r) => cell(payments, r, "Gmail Message ID")).filter(Boolean));
  const seenRefs = new Set(payments.rows.map((r) => cell(payments, r, "Reference")).filter(Boolean));
  // Only look at notices newer than the newest logged payment (or the last day on an empty tab).
  const latest = Math.max(
    0,
    ...payments.rows.map((r) => parseSheetDate(cell(payments, r, "Received"))?.getTime() ?? 0),
  );
  // 12h margin: sheet timestamps are Edmonton time but parse in the server's zone.
  // Anything inside the margin that's already logged is skipped by id / reference.
  const cutoff = latest ? latest - DAY_MS / 2 : Date.now() - DAY_MS;
  // Gmail's after: is day-granular, so search a day back and filter precisely below.
  const query = `from:${INTERAC_SENDER} after:${Math.floor((cutoff - DAY_MS) / 1000)}`;

  const result: PaymentRunResult = { checked: 0, logged: 0, byType: {}, errors: [] };
  console.info(`[payments] cutoff ${new Date(cutoff).toISOString()}${dryRun ? " (dry run)" : ""}`);
  const transfers: Transfer[] = [];

  for (const inbox of await gmailInboxes()) {
    try {
      const ids = await listAllGmailMessageIds(inbox.accessToken, query);
      for (const id of ids) {
        if (seenIds.has(id)) continue;
        result.checked += 1;
        try {
          const t = parseTransfer((await gmailFetch(inbox.accessToken, `messages/${id}?format=full`)) as GmailMessage, inbox.email);
          if (t.receivedAt.getTime() <= cutoff) continue;
          if (t.reference && seenRefs.has(t.reference)) continue;
          seenIds.add(id);
          if (t.reference) seenRefs.add(t.reference);
          transfers.push(t);
        } catch (error) {
          result.errors.push(`${inbox.email} ${id}: ${error instanceof Error ? error.message : String(error)}`);
        }
      }
    } catch (error) {
      result.errors.push(`${inbox.email}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  transfers.sort((a, b) => a.receivedAt.getTime() - b.receivedAt.getTime());

  for (const t of transfers) {
    try {
      const c: Classification = classify(state, t);
      if (c.signup && !dryRun) {
        await markPaid(accessToken, spreadsheetId, c.signup, t.receivedAt);
        if (c.type === "Membership" || c.type === "Donation" || c.type === "Vendor") {
          const signupRow = c.signup.tab.rows[c.signup.rowIndex];
          await autoPaymentReceived(c.type, toFields(c.signup.tab.headers, signupRow), {
            amount: t.amount,
            date: t.receivedAt.toLocaleDateString("en-CA", { timeZone: "America/Edmonton", dateStyle: "long" }),
          });
        }
      }
      const row = rowFromFields(payments.headers, {
        Received: formatTimestamp(t.receivedAt),
        Inbox: t.inbox,
        "Gmail Message ID": t.messageId,
        "Payer Name": t.name,
        "Payer Email": t.email,
        Amount: t.amount,
        Memo: t.memo,
        Type: c.type,
        "Matched To": c.signup ? describe(c.signup) : "",
        Reference: t.reference,
      });
      if (dryRun) {
        (result.preview ??= []).push(Object.fromEntries(payments.headers.map((h, i) => [h, row[i]])));
      } else {
        await appendSheetRow(accessToken, spreadsheetId, payments.name, row);
      }
      payments.rows.push(row);
      result.logged += 1;
      const label = c.type || "Needs a look";
      result.byType[label] = (result.byType[label] ?? 0) + 1;
    } catch (error) {
      result.errors.push(`${t.inbox} ${t.messageId}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  return result;
}

// ---------------------------------------------------------------- dashboard

export async function getPayments() {
  const spreadsheetId = masterSheetId();
  const { accessToken } = await getAccessTokenForAccount();
  const tab = await loadTab(accessToken, spreadsheetId, MASTER_TABS.payments);
  return { spreadsheetId, headers: tab.headers, rows: [...tab.rows].reverse() };
}

/** Staff override of a payment's Type, keyed by Gmail message id. */
export async function setPaymentType(messageId: string, type: PaymentType) {
  const spreadsheetId = masterSheetId();
  const { accessToken } = await getAccessTokenForAccount();
  const tab = await loadTab(accessToken, spreadsheetId, MASTER_TABS.payments);
  const rowIndex = tab.rows.findIndex((r) => cell(tab, r, "Gmail Message ID") === messageId);
  if (rowIndex < 0) throw new Error("Payment not found");
  const typeCol = colIndex(tab.headers, "Type");
  if (typeCol < 0) throw new Error("Payments tab has no Type column");
  await updateSheetCell(accessToken, spreadsheetId, tab.name, rowIndex + 2, typeCol + 1, type);
}

// ---------------------------------------------------------------- Stripe (card payments)

export type CardPayment = {
  /** Stripe Checkout Session id — stored in "Gmail Message ID" so it's deduped like any payment. */
  id: string;
  email: string;
  name: string;
  /** Dollars, e.g. "30.00". */
  amount: string;
  reference: string;
  receivedAt: Date;
};

/**
 * Logs a completed Stripe card payment and marks the payer's unpaid
 * membership/donation Paid (matched by email). Card links are only used for
 * memberships and donations, so an unmatched one is left for staff to type
 * rather than invoiced.
 */
export async function recordCardPayment(p: CardPayment): Promise<{ logged: boolean; type: string; matchedTo: string }> {
  const spreadsheetId = masterSheetId();
  const { accessToken } = await getAccessTokenForAccount();
  const [payments, masterList, donations, vendors] = await Promise.all([
    loadTab(accessToken, spreadsheetId, MASTER_TABS.payments),
    loadTab(accessToken, spreadsheetId, MASTER_TABS.masterList),
    loadTab(accessToken, spreadsheetId, MASTER_TABS.donations),
    loadTab(accessToken, spreadsheetId, MASTER_TABS.vendors),
  ]);
  await ensureHeaders(accessToken, spreadsheetId, payments, MASTER_HEADERS.payments);
  if (payments.rows.some((r) => cell(payments, r, "Gmail Message ID") === p.id)) {
    return { logged: false, type: "", matchedTo: "already logged" };
  }

  const state: State = { masterList, donations, vendors };
  const email = p.email.trim().toLowerCase();
  const signup = findByEmail(state, email, "Membership") ?? findByEmail(state, email, "Donation");
  if (signup) {
    await markPaid(accessToken, spreadsheetId, signup, p.receivedAt);
    await autoPaymentReceived(signup.type as "Membership" | "Donation", toFields(signup.tab.headers, signup.tab.rows[signup.rowIndex]), {
      amount: p.amount,
      date: p.receivedAt.toLocaleDateString("en-CA", { timeZone: "America/Edmonton", dateStyle: "long" }),
    });
  }
  const type = signup ? signup.type : "";
  const matchedTo = signup ? describe(signup) : "";
  await appendSheetRow(
    accessToken,
    spreadsheetId,
    payments.name,
    rowFromFields(payments.headers, {
      Received: formatTimestamp(p.receivedAt),
      Inbox: "Stripe",
      "Gmail Message ID": p.id,
      "Payer Name": p.name,
      "Payer Email": email,
      Amount: p.amount,
      Memo: "Card payment (Stripe)",
      Type: type,
      "Matched To": matchedTo,
      Reference: p.reference,
    }),
  );
  return { logged: true, type, matchedTo };
}

// ---------------------------------------------------------------- manual matching (dashboard)

type SignupKind = "Membership" | "Donation" | "Vendor";
const SIGNUP_TABS: Record<SignupKind, string> = {
  Membership: MASTER_TABS.masterList,
  Donation: MASTER_TABS.donations,
  Vendor: MASTER_TABS.vendors,
};

function kindForTab(tabName: string): SignupKind | null {
  const hit = (Object.entries(SIGNUP_TABS) as Array<[SignupKind, string]>).find(([, name]) => name === tabName);
  return hit ? hit[0] : null;
}

export type UnpaidSignup = { tab: string; rowNumber: number; name: string; email: string; code: string; signedUp: string };

/** Everyone of this kind who signed up and hasn't paid yet, newest first. */
export async function listUnpaidSignups(kind: SignupKind): Promise<UnpaidSignup[]> {
  const spreadsheetId = masterSheetId();
  const { accessToken } = await getAccessTokenForAccount();
  const tab = await loadTab(accessToken, spreadsheetId, SIGNUP_TABS[kind]);
  const out: UnpaidSignup[] = [];
  tab.rows.forEach((row, i) => {
    if (kind === "Membership" && !isMembershipRow(tab, row)) return;
    if (isPaid(cell(tab, row, "Paid"))) return;
    if (!cell(tab, row, "Full Name") && !cell(tab, row, "Email")) return;
    out.push({
      tab: tab.name,
      rowNumber: i + 2,
      name: cell(tab, row, "Full Name"),
      email: cell(tab, row, "Email"),
      code: cell(tab, row, "Payment Code"),
      signedUp: cell(tab, row, "Timestamp"),
    });
  });
  const time = (s: UnpaidSignup) => parseSheetDate(s.signedUp)?.getTime() ?? 0;
  return out.sort((a, b) => time(b) - time(a));
}

/** Mark one sign-up row Paid (with today's date) or back to unpaid. Stops/restarts its reminders. */
export async function setSignupPaid(tabName: string, rowNumber: number, paid: boolean): Promise<void> {
  if (!kindForTab(tabName)) throw new Error("That list doesn't take payments");
  const spreadsheetId = masterSheetId();
  const { accessToken } = await getAccessTokenForAccount();
  const tab = await loadTab(accessToken, spreadsheetId, tabName);
  const rowIndex = rowNumber - 2;
  if (rowIndex < 0 || rowIndex >= tab.rows.length) throw new Error("Row not found");
  if (paid) {
    await markPaid(accessToken, spreadsheetId, { tab, rowIndex, type: kindForTab(tabName)! }, new Date());
    return;
  }
  for (const col of ["Paid", "Paid Date"]) {
    const c = colIndex(tab.headers, col);
    if (c >= 0) await updateSheetCell(accessToken, spreadsheetId, tab.name, rowNumber, c + 1, "");
  }
}

/**
 * Staff say who an e-Transfer was for: the payment gets that person's name and
 * type, their sign-up is marked Paid (stopping reminders), and they get the
 * usual receipt if automatic emails are on.
 */
export async function linkPaymentToSignup(messageId: string, tabName: string, rowNumber: number): Promise<{ name: string; type: SignupKind }> {
  const kind = kindForTab(tabName);
  if (!kind) throw new Error("That list doesn't take payments");
  const spreadsheetId = masterSheetId();
  const { accessToken } = await getAccessTokenForAccount();
  const [payments, tab] = await Promise.all([
    loadTab(accessToken, spreadsheetId, MASTER_TABS.payments),
    loadTab(accessToken, spreadsheetId, tabName),
  ]);
  const payIndex = payments.rows.findIndex((r) => cell(payments, r, "Gmail Message ID") === messageId);
  if (payIndex < 0) throw new Error("Payment not found");
  const rowIndex = rowNumber - 2;
  if (rowIndex < 0 || rowIndex >= tab.rows.length) throw new Error("Person not found");

  const signup: Signup = { tab, rowIndex, type: kind };
  const name = describe(signup);
  const payRow = payments.rows[payIndex];
  const received = parseSheetDate(cell(payments, payRow, "Received")) ?? new Date();

  for (const [col, value] of [["Type", kind], ["Matched To", name]] as const) {
    const c = colIndex(payments.headers, col);
    if (c >= 0) await updateSheetCell(accessToken, spreadsheetId, payments.name, payIndex + 2, c + 1, value);
  }
  const wasPaid = isPaid(cell(tab, tab.rows[rowIndex], "Paid"));
  await markPaid(accessToken, spreadsheetId, signup, received);
  if (!wasPaid) {
    await autoPaymentReceived(kind, toFields(tab.headers, tab.rows[rowIndex]), {
      amount: cell(payments, payRow, "Amount"),
      date: received.toLocaleDateString("en-CA", { timeZone: "America/Edmonton", dateStyle: "long" }),
    });
  }
  return { name, type: kind };
}
