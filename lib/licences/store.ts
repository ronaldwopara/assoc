/**
 * Licences, kept on the master sheet's "Licences" tab.
 *
 * Stripe is the source of truth for billing; this tab is the source of truth
 * for access. The webhook keeps the two in step:
 *   checkout.session.completed      → new row, access email
 *   invoice.paid                    → push Access Until to the paid period's end
 *   customer.subscription.updated   → Status / Access Until follow the subscription
 *   customer.subscription.deleted   → Status "Ended"
 *
 * Someone who gives their email and heads to Stripe gets a "Checkout started"
 * row first; paying turns that same row into their licence. Until then the
 * daily reminder run (lib/reminders.ts) nudges them on the usual schedule.
 */

import {
  appendSheetRow,
  ensureCheckboxColumn,
  ensureSheetTab,
  isStopTicked,
  getAccessTokenForAccount,
  getSheetValues,
  updateSheetRow,
} from "@/lib/google-sheets";
import { MASTER_HEADERS, MASTER_TABS, colIndex, masterSheetId, rowFromFields } from "@/lib/master-sheet";
import { formatTimestamp, parseSheetDate } from "@/lib/sheet-dates";
import type { LicenceTerm } from "@/lib/licences/catalogue";

const TAB = MASTER_TABS.licences;
/** A renewal that's a little late (card retry) shouldn't lock a school out mid-lesson. */
const GRACE_DAYS = 3;

type Loaded = { accessToken: string; spreadsheetId: string; headers: string[]; rows: string[][] };

async function load(): Promise<Loaded> {
  const spreadsheetId = masterSheetId();
  const { accessToken } = await getAccessTokenForAccount();
  await ensureSheetTab(accessToken, spreadsheetId, TAB);
  const [first = [], ...rows] = await getSheetValues(accessToken, spreadsheetId, TAB);
  let headers = first;
  const missing = MASTER_HEADERS.licences.filter((h) => colIndex(headers, h) < 0);
  if (missing.length) {
    headers = [...headers, ...missing];
    await updateSheetRow(accessToken, spreadsheetId, TAB, 1, headers);
  }
  await ensureCheckboxColumn(accessToken, spreadsheetId, TAB, colIndex(headers, "Stop Reminders")).catch(() => {});
  return { accessToken, spreadsheetId, headers, rows };
}

const get = (l: Loaded, row: string[], col: string) => String(row[colIndex(l.headers, col)] ?? "").trim();

function set(l: Loaded, row: string[], col: string, value: string) {
  const i = colIndex(l.headers, col);
  if (i < 0) return;
  while (row.length <= i) row.push("");
  row[i] = value;
}

function addTerm(from: Date, term: LicenceTerm): Date {
  const d = new Date(from);
  if (term === "month") d.setMonth(d.getMonth() + 1);
  else d.setFullYear(d.getFullYear() + 1);
  return d;
}

export type NewLicence = {
  sessionId: string;
  subscriptionId: string;
  customerId: string;
  email: string;
  /** The email they typed on our site before checkout, if different. */
  enteredEmail?: string;
  name: string;
  tier: string;
  term: LicenceTerm;
  /** Dollars, e.g. "150.00". */
  amount: string;
  paidAt: Date;
};

/**
 * Records a new licence. Idempotent on the Stripe session id, so a retried
 * webhook doesn't add a second row. Returns false when it was already there.
 */
export async function recordLicence(
  n: NewLicence,
): Promise<{ created: boolean; rowNumber: number; emailSent: boolean }> {
  const l = await load();
  const existing = l.rows.findIndex((r) => get(l, r, "Stripe Session") === n.sessionId);
  if (existing >= 0) {
    return { created: false, rowNumber: existing + 2, emailSent: Boolean(get(l, l.rows[existing], "Access Email Sent")) };
  }

  const email = n.email.trim().toLowerCase();
  const fields: Record<string, string> = {
    Timestamp: formatTimestamp(n.paidAt),
    "Full Name": n.name,
    Email: email,
    Tier: n.tier,
    Term: n.term,
    Amount: n.amount,
    Status: "Active",
    // Provisional until invoice.paid gives the exact period end.
    "Access Until": formatTimestamp(addTerm(n.paidAt, n.term)),
    "Last Payment": formatTimestamp(n.paidAt),
    "Stripe Subscription": n.subscriptionId,
    "Stripe Customer": n.customerId,
    "Stripe Session": n.sessionId,
  };

  // Paying turns their "Checkout started" row into the licence, which also stops the reminders.
  // Match on the Stripe email or the one typed on our site (they can change it at checkout).
  const startedEmails = new Set([email, (n.enteredEmail ?? "").trim().toLowerCase()].filter(Boolean));
  const started = l.rows.findIndex((r) => isCheckoutStarted(l, r) && startedEmails.has(get(l, r, "Email").toLowerCase()));
  if (started >= 0) {
    const row = [...l.rows[started]];
    for (const [col, value] of Object.entries(fields)) set(l, row, col, value);
    await updateSheetRow(l.accessToken, l.spreadsheetId, TAB, started + 2, padTo(row, l.headers.length));
    return { created: true, rowNumber: started + 2, emailSent: false };
  }

  const rowNumber = await appendSheetRow(l.accessToken, l.spreadsheetId, TAB, rowFromFields(l.headers, fields));
  return { created: true, rowNumber, emailSent: false };
}

const CHECKOUT_STARTED = "Checkout started";
const isCheckoutStarted = (l: Loaded, row: string[]) => get(l, row, "Status").toLowerCase() === CHECKOUT_STARTED.toLowerCase();

/**
 * Someone gave their email and went to Stripe. One row per email: going
 * again updates the plan but keeps the first Timestamp, so the reminder
 * schedule counts from first contact. Skipped if they already hold a licence.
 */
export async function recordCheckoutStarted(c: { email: string; tier: string; term: LicenceTerm; amount: string }): Promise<void> {
  const email = c.email.trim().toLowerCase();
  if (!email || (await activeLicenceFor(email))) return;
  const l = await load();
  const index = l.rows.findIndex((r) => isCheckoutStarted(l, r) && get(l, r, "Email").toLowerCase() === email);
  if (index >= 0) {
    const row = [...l.rows[index]];
    set(l, row, "Tier", c.tier);
    set(l, row, "Term", c.term);
    set(l, row, "Amount", c.amount);
    await updateSheetRow(l.accessToken, l.spreadsheetId, TAB, index + 2, padTo(row, l.headers.length));
    return;
  }
  await appendSheetRow(
    l.accessToken,
    l.spreadsheetId,
    TAB,
    rowFromFields(l.headers, {
      Timestamp: formatTimestamp(new Date()),
      Email: email,
      Tier: c.tier,
      Term: c.term,
      Amount: c.amount,
      Status: CHECKOUT_STARTED,
      "Reminder Count": "0",
    }),
  );
}

export type PendingCheckout = {
  rowNumber: number;
  email: string;
  tier: string;
  term: string;
  started: string;
  reminderCount: number;
};

/** "Checkout started" rows still worth chasing ("Stop Reminders" not ticked). */
export async function pendingCheckouts(): Promise<PendingCheckout[]> {
  const l = await load();
  const out: PendingCheckout[] = [];
  l.rows.forEach((r, i) => {
    if (!isCheckoutStarted(l, r) || isStopTicked(get(l, r, "Stop Reminders")) || !get(l, r, "Email")) return;
    out.push({
      rowNumber: i + 2,
      email: get(l, r, "Email").toLowerCase(),
      tier: get(l, r, "Tier"),
      term: get(l, r, "Term"),
      started: get(l, r, "Timestamp"),
      reminderCount: Number(get(l, r, "Reminder Count")) || 0,
    });
  });
  return out;
}

/** Records that a reminder went out. */
export async function markCheckoutReminded(rowNumber: number, count: number): Promise<void> {
  const l = await load();
  const row = [...(l.rows[rowNumber - 2] ?? [])];
  set(l, row, "Reminder Count", String(count));
  set(l, row, "Last Reminder", formatTimestamp(new Date()));
  await updateSheetRow(l.accessToken, l.spreadsheetId, TAB, rowNumber, padTo(row, l.headers.length));
}

/** Stamps "Access Email Sent" on a row. */
export async function markAccessEmailSent(rowNumber: number): Promise<void> {
  const l = await load();
  const row = [...(l.rows[rowNumber - 2] ?? [])];
  set(l, row, "Access Email Sent", formatTimestamp(new Date()));
  await updateSheetRow(l.accessToken, l.spreadsheetId, TAB, rowNumber, padTo(row, l.headers.length));
}

export type SubscriptionChange = {
  subscriptionId: string;
  status?: string;
  accessUntil?: Date;
  paidAt?: Date;
};

/**
 * Applies a change from Stripe to the subscription's row. Returns false when
 * no row exists yet (the checkout webhook hasn't landed), so the caller can
 * ask Stripe to retry.
 */
export async function updateSubscription(c: SubscriptionChange): Promise<boolean> {
  const l = await load();
  const index = l.rows.findIndex((r) => get(l, r, "Stripe Subscription") === c.subscriptionId);
  if (index < 0) return false;
  const row = [...l.rows[index]];
  if (c.status) set(l, row, "Status", c.status);
  if (c.accessUntil) set(l, row, "Access Until", formatTimestamp(c.accessUntil));
  if (c.paidAt) set(l, row, "Last Payment", formatTimestamp(c.paidAt));
  await updateSheetRow(l.accessToken, l.spreadsheetId, TAB, index + 2, padTo(row, l.headers.length));
  return true;
}

export type ActiveLicence = { email: string; name: string; tier: string; term: string; accessUntil: string };

/** The email's licence that is still running, if any (the one that lasts longest). */
export async function activeLicenceFor(email: string): Promise<ActiveLicence | null> {
  const want = email.trim().toLowerCase();
  if (!want) return null;
  const l = await load();
  const now = Date.now();
  let best: { licence: ActiveLicence; until: number } | null = null;
  for (const r of l.rows) {
    if (get(l, r, "Email").toLowerCase() !== want) continue;
    if (/^ended$/i.test(get(l, r, "Status")) || isCheckoutStarted(l, r)) continue;
    const untilRaw = get(l, r, "Access Until");
    const until = parseSheetDate(untilRaw)?.getTime() ?? NaN;
    // A hand-typed row with no end date counts as open-ended.
    const effective = Number.isFinite(until) ? until : Number.POSITIVE_INFINITY;
    if (effective + GRACE_DAYS * 86_400_000 < now) continue;
    if (!best || effective > best.until) {
      best = {
        until: effective,
        licence: { email: want, name: get(l, r, "Full Name"), tier: get(l, r, "Tier"), term: get(l, r, "Term"), accessUntil: untilRaw },
      };
    }
  }
  return best?.licence ?? null;
}

function padTo(row: string[], length: number): string[] {
  const out = [...row];
  while (out.length < length) out.push("");
  return out;
}
