/**
 * Sends email through the Gmail API as support@asosc.ca.
 *
 * Needs the gmail.send scope: after deploying, reconnect support@asosc.ca once
 * at /api/google/connect. Automatic sends (form confirmations, payment
 * receipts, reminders) only happen when staff switch them on in the dashboard; manual sends from
 * the dashboard always work. The automatic switch lives in lib/settings.ts.
 */

import { randomBytes } from "node:crypto";
import { listGoogleAccounts } from "@/lib/google-oauth";
import { getAccessTokenForAccount } from "@/lib/google-sheets";

export const SENDER_EMAIL = "support@asosc.ca";
const SENDER_NAME = "Africans Society of Strathcona County";

export type EmailAttachment = { filename: string; contentType: string; content: Buffer };
export type OutgoingEmail = {
  to: string;
  subject: string;
  html: string;
  text: string;
  attachments?: EmailAttachment[];
  /** Extra headers, e.g. List-Unsubscribe. */
  headers?: Record<string, string>;
};

/** RFC 2047 encoded-word so non-ASCII subjects/names survive. */
function encodeHeader(value: string): string {
  return /^[\x00-\x7F]*$/.test(value) ? value : `=?UTF-8?B?${Buffer.from(value, "utf8").toString("base64")}?=`;
}

function base64Lines(buf: Buffer): string {
  return buf.toString("base64").replace(/.{76}(?=.)/g, "$&\r\n");
}

function buildMime(email: OutgoingEmail): string {
  const alt = `alt_${randomBytes(12).toString("hex")}`;
  const mixed = `mix_${randomBytes(12).toString("hex")}`;
  const hasAttachments = Boolean(email.attachments?.length);

  const headers = [
    `From: ${encodeHeader(SENDER_NAME)} <${SENDER_EMAIL}>`,
    `To: ${email.to}`,
    `Reply-To: ${SENDER_EMAIL}`,
    `Subject: ${encodeHeader(email.subject)}`,
    ...Object.entries(email.headers ?? {}).map(([k, v]) => `${k.replace(/[^A-Za-z-]/g, "")}: ${v.replace(/[\r\n]/g, "")}`),
    "MIME-Version: 1.0",
    `Content-Type: ${hasAttachments ? `multipart/mixed; boundary="${mixed}"` : `multipart/alternative; boundary="${alt}"`}`,
  ];

  const alternative = [
    `--${alt}`,
    "Content-Type: text/plain; charset=UTF-8",
    "Content-Transfer-Encoding: base64",
    "",
    base64Lines(Buffer.from(email.text, "utf8")),
    `--${alt}`,
    "Content-Type: text/html; charset=UTF-8",
    "Content-Transfer-Encoding: base64",
    "",
    base64Lines(Buffer.from(email.html, "utf8")),
    `--${alt}--`,
  ];

  if (!hasAttachments) return [...headers, "", ...alternative, ""].join("\r\n");

  const parts = [`--${mixed}`, `Content-Type: multipart/alternative; boundary="${alt}"`, "", ...alternative];
  for (const a of email.attachments!) {
    const name = a.filename.replace(/["\r\n]/g, "");
    parts.push(
      `--${mixed}`,
      `Content-Type: ${a.contentType}; name="${name}"`,
      `Content-Disposition: attachment; filename="${name}"`,
      "Content-Transfer-Encoding: base64",
      "",
      base64Lines(a.content),
    );
  }
  parts.push(`--${mixed}--`);
  return [...headers, "", ...parts, ""].join("\r\n");
}

export async function senderCanSend(): Promise<boolean> {
  const accounts = await listGoogleAccounts();
  const sender = accounts.find((a) => a.email.toLowerCase() === SENDER_EMAIL);
  return Boolean(sender?.scope?.includes("gmail.send"));
}

/** Sends one email; returns the Gmail message id. */
export async function sendEmail(email: OutgoingEmail): Promise<string> {
  const to = email.to.trim();
  if (!/^[^\s@,<>]+@[^\s@,<>]+\.[^\s@,<>]+$/.test(to)) throw new Error(`Invalid recipient: ${to || "(blank)"}`);

  if (!(await senderCanSend())) {
    throw new Error(
      `${SENDER_EMAIL} can't send yet. Open /api/google/connect signed in as ${SENDER_EMAIL} and allow sending email.`,
    );
  }
  const { accessToken } = await getAccessTokenForAccount(SENDER_EMAIL);
  const raw = Buffer.from(buildMime({ ...email, to }), "utf8").toString("base64url");

  const res = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ raw }),
  });
  const payload = (await res.json().catch(() => null)) as { id?: string; error?: { message?: string } } | null;
  if (!res.ok || !payload?.id) {
    throw new Error(payload?.error?.message || `Gmail send failed (${res.status})`);
  }
  return payload.id;
}
