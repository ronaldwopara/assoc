/** Shared Gmail API helpers (read-only inbox access) used by payment and expense capture. */

import { listGoogleAccounts } from "@/lib/google-oauth";
import { getAccessTokenForAccount } from "@/lib/google-sheets";

/** Inboxes that receive Interac e-Transfers and expense mail. */
export const DEFAULT_INBOXES = ["payment@asosc.ca", "support@asosc.ca", "africanssocietyofsc@gmail.com"];

export type GmailSession = { email: string; accessToken: string };
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

export async function gmailFetch(accessToken: string, path: string) {
  const response = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/${path}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });
  const payload = (await response.json()) as {
    error?: { message?: string };
    messages?: Array<{ id: string }>;
    [k: string]: unknown;
  };
  if (!response.ok) {
    throw new Error(payload.error?.message || `Gmail API failed (${response.status})`);
  }
  return payload;
}

/** messages.list pages at 500 max; page through everything so nothing past page one is silently dropped. */
export async function listAllGmailMessageIds(accessToken: string, query: string, maxPages = 20): Promise<string[]> {
  const ids: string[] = [];
  let pageToken: string | undefined;
  for (let page = 0; page < maxPages; page++) {
    const path = `messages?q=${encodeURIComponent(query)}&maxResults=500${pageToken ? `&pageToken=${pageToken}` : ""}`;
    const list = (await gmailFetch(accessToken, path)) as {
      messages?: Array<{ id: string }>;
      nextPageToken?: string;
    };
    ids.push(...(list.messages ?? []).map((m) => m.id));
    if (!list.nextPageToken) break;
    pageToken = list.nextPageToken;
  }
  return ids;
}

function configuredInboxes(): string[] {
  const fromEnv = [process.env.INTERAC_GMAIL_ACCOUNTS, process.env.INTERAC_GMAIL_ACCOUNT]
    .flatMap((value) => (value ?? "").split(/[,;]/))
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
  return [...new Set([...fromEnv, ...DEFAULT_INBOXES.map((email) => email.toLowerCase())])];
}

function accountHasGmail(account: { scope?: string }) {
  const scope = account.scope ?? "";
  return scope.includes("gmail") || scope.includes("mail.google.com");
}

/** An access token for every connected account that can read Gmail. */
export async function gmailInboxes(): Promise<GmailSession[]> {
  const accounts = await listGoogleAccounts();
  if (accounts.length === 0) {
    throw new Error(
      "No Google account is connected. Sign in at /upgrade, then open /api/google/connect once for each inbox (payment@asosc.ca, support@asosc.ca, africanssocietyofsc@gmail.com).",
    );
  }

  const wanted = new Set(configuredInboxes());
  const targets = accounts.filter(
    (account) => wanted.has(account.email.toLowerCase()) || accountHasGmail(account),
  );

  const sessions: GmailSession[] = [];
  const errors: string[] = [];
  for (const account of targets) {
    try {
      sessions.push(await getAccessTokenForAccount(account.email));
    } catch (error) {
      errors.push(`${account.email}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  if (sessions.length === 0) {
    throw new Error(errors.join("; ") || "No Google account with Gmail access is connected.");
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

export function isPaid(value: string): boolean {
  return value.trim().toLowerCase() === "paid";
}
