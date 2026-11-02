/**
 * Mailing-list opt-outs, kept on the master sheet's "Unsubscribed" tab
 * (Email | Unsubscribed At). Links carry an HMAC so nobody can unsubscribe
 * someone else by editing the URL.
 */

import { createHmac, timingSafeEqual } from "node:crypto";
import {
  appendSheetRow,
  ensureSheetTab,
  getAccessTokenForAccount,
  getSheetValues,
  updateSheetRow,
} from "@/lib/google-sheets";
import { masterSheetId } from "@/lib/master-sheet";
import { formatTimestamp } from "@/lib/sheet-dates";

const TAB = "Unsubscribed";
export const SITE_ORIGIN = (process.env.NEXT_PUBLIC_SITE_URL?.trim() || "https://asosc.ca").replace(/\/$/, "");

function secret(): string {
  const s = process.env.UPGRADE_SESSION_SECRET || process.env.GOOGLE_TOKEN_SECRET || process.env.UPGRADE_PASSWORD;
  if (!s) throw new Error("No secret configured for unsubscribe links");
  return s;
}

const norm = (email: string) => email.trim().toLowerCase();

export function unsubscribeToken(email: string): string {
  return createHmac("sha256", secret()).update(`unsubscribe:${norm(email)}`).digest("base64url").slice(0, 32);
}

export function verifyUnsubscribeToken(email: string, token: string): boolean {
  const a = Buffer.from(unsubscribeToken(email));
  const b = Buffer.from(String(token ?? ""));
  return a.length === b.length && timingSafeEqual(a, b);
}

export function unsubscribeUrl(email: string): string {
  return `${SITE_ORIGIN}/unsubscribe?e=${encodeURIComponent(norm(email))}&t=${unsubscribeToken(email)}`;
}

export async function unsubscribedEmails(): Promise<Set<string>> {
  const { accessToken } = await getAccessTokenForAccount();
  try {
    const [, ...rows] = await getSheetValues(accessToken, masterSheetId(), TAB);
    return new Set(rows.map((r) => norm(String(r[0] ?? ""))).filter(Boolean));
  } catch {
    return new Set();
  }
}

export async function setUnsubscribed(email: string, unsubscribed: boolean): Promise<void> {
  const target = norm(email);
  const spreadsheetId = masterSheetId();
  const { accessToken } = await getAccessTokenForAccount();
  await ensureSheetTab(accessToken, spreadsheetId, TAB);
  const all = await getSheetValues(accessToken, spreadsheetId, TAB);
  if (all.length === 0) await updateSheetRow(accessToken, spreadsheetId, TAB, 1, ["Email", "Unsubscribed At"]);
  const index = all.findIndex((r, i) => i > 0 && norm(String(r[0] ?? "")) === target);
  if (unsubscribed && index < 0) await appendSheetRow(accessToken, spreadsheetId, TAB, [target, formatTimestamp(new Date())]);
  if (!unsubscribed && index > 0) await updateSheetRow(accessToken, spreadsheetId, TAB, index + 1, ["", ""]);
}
