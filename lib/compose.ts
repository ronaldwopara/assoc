/**
 * Dashboard composer: who an email goes to, and sending it one personalised
 * copy at a time (with an unsubscribe link) in small batches so a big list
 * never hits the serverless time limit. Every send is logged on the master
 * sheet's "Email Log" tab.
 */

import { appendSheetRows, ensureSheetTab, getAccessTokenForAccount, getSheetValues } from "@/lib/google-sheets";
import { composerEmail, type ComposerAttachment, type ComposerContent } from "@/lib/emails";
import { isPaid } from "@/lib/gmail";
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
};

/** Deduped, valid, not-unsubscribed recipients for the chosen lists plus any typed addresses. */
export async function resolveRecipients(opts: {
  lists: RecipientListId[];
  memberFilter?: MemberFilter;
  extra?: string;
}): Promise<{ recipients: Recipient[]; skippedUnsubscribed: number; invalid: string[] }> {
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
    for (const row of rows) {
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
  for (const raw of (opts.extra ?? "").split(/[\s,;]+/).filter(Boolean)) {
    if (!add(raw, "")) invalid.push(raw);
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
  return { recipients, skippedUnsubscribed, invalid };
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
