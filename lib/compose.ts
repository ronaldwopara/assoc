/**
 * Dashboard composer: who an email goes to, and sending it one personalised
 * copy at a time (with an unsubscribe link) in small batches so a big list
 * never hits the serverless time limit. Every send is logged on the master
 * sheet's "Email Log" tab.
 */

import { appendSheetRows, ensureSheetTab, getAccessTokenForAccount, getSheetValues } from "@/lib/google-sheets";
import { composerEmail, type ComposerAttachment, type ComposerContent } from "@/lib/emails";
import { isPaid } from "@/lib/gmail";
import { listEventForms } from "@/lib/event-forms";
import { sendEmail, type EmailAttachment } from "@/lib/mailer";
import { MASTER_TABS, colIndex, masterSheetId } from "@/lib/master-sheet";
import { formatTimestamp } from "@/lib/sheet-dates";
import { SITE_ORIGIN, unsubscribedEmails, unsubscribeToken, unsubscribeUrl } from "@/lib/unsubscribe";

export const RECIPIENT_LISTS = {
  masterList: "Everyone (Master List)",
  members: "Members",
  volunteers: "Volunteers",
  vendors: "Vendors",
  newsletter: "Newsletter",
  contact: "Contact form",
  donors: "Donors",
  events: "Event registrations",
} as const;
export type RecipientListId = keyof typeof RECIPIENT_LISTS;
export type MemberFilter = "all" | "paid" | "unpaid";

export function isRecipientListId(v: unknown): v is RecipientListId {
  return typeof v === "string" && v in RECIPIENT_LISTS;
}

export type Recipient = { email: string; name: string };

const EMAIL_RE = /^[^\s@,<>]+@[^\s@,<>]+\.[^\s@,<>]+$/;
export const MAX_BATCH = 10;
const MAX_ATTACHMENT_BYTES = 15 * 1024 * 1024; // Gmail's 25MB cap, minus base64 growth

const TAB_FOR: Record<RecipientListId, string> = {
  masterList: MASTER_TABS.masterList,
  members: MASTER_TABS.masterList,
  volunteers: MASTER_TABS.volunteers,
  vendors: MASTER_TABS.vendors,
  newsletter: MASTER_TABS.newsletter,
  contact: MASTER_TABS.contact,
  donors: MASTER_TABS.donations,
  events: MASTER_TABS.registrations,
};

/** Which form a volunteer came through (blank on rows from before the column existed = the website). */
const volunteerFrom = (value: string) => value.trim() || "Website";

/**
 * The "From" choices for narrowing a list: where volunteers signed up, and
 * which event people registered for, each with how many rows it has.
 */
export async function audienceOptions(): Promise<{ volunteerFrom: Array<{ value: string; count: number }>; events: Array<{ value: string; count: number }> }> {
  const spreadsheetId = masterSheetId();
  const { accessToken } = await getAccessTokenForAccount();
  const count = async (tab: string, col: string, norm: (v: string) => string) => {
    const [headers = [], ...rows] = await getSheetValues(accessToken, spreadsheetId, tab).catch(() => [] as string[][]);
    const c = colIndex(headers, col);
    const counts = new Map<string, number>();
    for (const row of rows) {
      const v = norm(String(row[c] ?? ""));
      if (v) counts.set(v, (counts.get(v) ?? 0) + 1);
    }
    return [...counts].map(([value, n]) => ({ value, count: n })).sort((a, b) => b.count - a.count);
  };
  const [volunteers, events, forms] = await Promise.all([
    count(MASTER_TABS.volunteers, "From", volunteerFrom),
    count(MASTER_TABS.registrations, "Event", (v) => v.trim()),
    listEventForms().catch(() => []),
  ]);
  // Every linked event form shows up, even before anyone has signed up through it.
  const withForms = (list: Array<{ value: string; count: number }>, names: string[]) => {
    const have = new Set(list.map((o) => o.value.toLowerCase()));
    return [...list, ...[...new Set(names)].filter((n) => !have.has(n.toLowerCase())).map((value) => ({ value, count: 0 }))];
  };
  return {
    volunteerFrom: withForms(volunteers, ["Website", ...forms.filter((f) => f.kind === "volunteer").map((f) => f.name)]),
    events: withForms(events, forms.filter((f) => f.kind === "event").map((f) => f.name)),
  };
}

/** Deduped, valid, not-unsubscribed recipients for the chosen lists plus any typed addresses. */
export async function resolveRecipients(opts: {
  lists: RecipientListId[];
  memberFilter?: MemberFilter;
  /** Only volunteers from these forms (empty = all). */
  volunteerFrom?: string[];
  /** Only people registered for these events (empty = all events). */
  events?: string[];
  extra?: string;
}): Promise<{ recipients: Recipient[]; skippedUnsubscribed: number; invalid: string[]; unsubscribedTyped: string[] }> {
  const spreadsheetId = masterSheetId();
  const { accessToken } = await getAccessTokenForAccount();
  const byEmail = new Map<string, Recipient>();
  const add = (email: string, name: string) => {
    const e = email.trim().toLowerCase();
    if (!EMAIL_RE.test(e)) return false;
    if (!byEmail.has(e) || (!byEmail.get(e)!.name && name)) byEmail.set(e, { email: e, name: name.trim() });
    return true;
  };

  const tabs = [...new Set(opts.lists.map((l) => TAB_FOR[l]))];
  const values = new Map(
    await Promise.all(tabs.map(async (t) => [t, await getSheetValues(accessToken, spreadsheetId, t)] as const)),
  );
  for (const list of opts.lists) {
    const [headers = [], ...rows] = values.get(TAB_FOR[list]) ?? [];
    const e = colIndex(headers, "Email");
    const n = colIndex(headers, "Full Name");
    const source = colIndex(headers, "Source");
    const paid = colIndex(headers, "Paid");
    const from = colIndex(headers, "From");
    const event = colIndex(headers, "Event");
    const wantFrom = new Set((opts.volunteerFrom ?? []).map((v) => v.toLowerCase()));
    const wantEvents = new Set((opts.events ?? []).map((v) => v.toLowerCase()));
    for (const row of rows) {
      if (list === "volunteers" && wantFrom.size && !wantFrom.has(volunteerFrom(String(row[from] ?? "")).toLowerCase())) continue;
      if (list === "events" && wantEvents.size && !wantEvents.has(String(row[event] ?? "").trim().toLowerCase())) continue;
      if (list === "members") {
        if (!/^membership$/i.test(String(row[source] ?? "").trim())) continue;
        const isP = isPaid(String(row[paid] ?? ""));
        if (opts.memberFilter === "paid" && !isP) continue;
        if (opts.memberFilter === "unpaid" && isP) continue;
      }
      add(String(row[e] ?? ""), String(row[n] ?? ""));
    }
  }

  const invalid: string[] = [];
  const typed: string[] = [];
  for (const raw of (opts.extra ?? "").split(/[\s,;]+/).filter(Boolean)) {
    if (!add(raw, "")) invalid.push(raw);
    else typed.push(raw.trim().toLowerCase());
  }

  const unsubscribed = await unsubscribedEmails();
  let skippedUnsubscribed = 0;
  const recipients = [...byEmail.values()].filter((r) => {
    if (unsubscribed.has(r.email)) {
      skippedUnsubscribed += 1;
      return false;
    }
    return true;
  });
  // Addresses typed in by hand that are on the unsubscribe list, so the screen can say who and why.
  const unsubscribedTyped = [...new Set(typed.filter((e) => unsubscribed.has(e)))];
  return { recipients, skippedUnsubscribed, invalid, unsubscribedTyped };
}

/** Only our own Cloudinary uploads can be attached (never an arbitrary URL). */
function isOwnUpload(url: string): boolean {
  try {
    const u = new URL(url);
    const cloud = process.env.CLOUDINARY_CLOUD_NAME?.trim();
    return u.protocol === "https:" && u.hostname === "res.cloudinary.com" && Boolean(cloud) && u.pathname.startsWith(`/${cloud}/`);
  } catch {
    return false;
  }
}

async function loadAttachments(list: ComposerAttachment[] = []): Promise<EmailAttachment[]> {
  const out: EmailAttachment[] = [];
  let total = 0;
  for (const a of list) {
    if (!isOwnUpload(a.url)) throw new Error(`Attachment "${a.name}" isn't an uploaded file`);
    const res = await fetch(a.url, { cache: "no-store" });
    if (!res.ok) throw new Error(`Couldn't load attachment "${a.name}" (${res.status})`);
    const content = Buffer.from(await res.arrayBuffer());
    total += content.length;
    if (total > MAX_ATTACHMENT_BYTES) throw new Error("Attachments are too large (15MB total max)");
    out.push({ filename: a.name, contentType: a.type || "application/octet-stream", content });
  }
  return out;
}

export type SendResult = { email: string; ok: boolean; error?: string };

/** Sends one batch (≤ MAX_BATCH) and logs it. Unsubscribed addresses are re-checked and skipped. */
export async function sendBatch(content: ComposerContent, batch: Recipient[], opts: { test?: boolean } = {}): Promise<SendResult[]> {
  if (batch.length === 0) return [];
  if (batch.length > MAX_BATCH) throw new Error(`Send at most ${MAX_BATCH} at a time`);
  if (!content.subject?.trim()) throw new Error("Add a subject first");

  const attachments = await loadAttachments(content.attachments);
  const unsubscribed = opts.test ? new Set<string>() : await unsubscribedEmails();
  const results: SendResult[] = [];

  for (const r of batch) {
    const email = r.email.trim().toLowerCase();
    if (!EMAIL_RE.test(email)) {
      results.push({ email, ok: false, error: "Invalid address" });
      continue;
    }
    if (unsubscribed.has(email)) {
      results.push({ email, ok: false, error: "Unsubscribed" });
      continue;
    }
    try {
      const unsub = unsubscribeUrl(email);
      const oneClick = `${SITE_ORIGIN}/api/unsubscribe?e=${encodeURIComponent(email)}&t=${unsubscribeToken(email)}`;
      const message = composerEmail(content, { email, name: r.name }, unsub);
      await sendEmail({
        ...message,
        subject: opts.test ? `[TEST] ${message.subject}` : message.subject,
        attachments,
        headers: {
          "List-Unsubscribe": `<${oneClick}>, <mailto:support@asosc.ca?subject=Unsubscribe>`,
          "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
        },
      });
      results.push({ email, ok: true });
    } catch (error) {
      results.push({ email, ok: false, error: error instanceof Error ? error.message : String(error) });
    }
  }

  try {
    const spreadsheetId = masterSheetId();
    const { accessToken } = await getAccessTokenForAccount();
    await ensureSheetTab(accessToken, spreadsheetId, "Email Log");
    const existing = await getSheetValues(accessToken, spreadsheetId, "Email Log");
    const rows = results.map((x) => [
      formatTimestamp(new Date()),
      opts.test ? `[TEST] ${content.subject}` : content.subject,
      x.email,
      x.ok ? "Sent" : "Failed",
      x.error ?? "",
    ]);
    if (existing.length === 0) rows.unshift(["Sent At", "Subject", "Email", "Status", "Error"]);
    await appendSheetRows(accessToken, spreadsheetId, "Email Log", rows);
  } catch (error) {
    console.error("[compose] couldn't write Email Log:", error);
  }
  return results;
}
