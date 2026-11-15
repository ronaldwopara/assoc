import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

/**
 * Sign-in for licence holders, by emailed link. No passwords: the link is the
 * proof that the person can read the inbox the licence is under.
 *
 * Two signed tokens, both HMAC'd with LICENCE_SESSION_SECRET:
 *   link    "l.<email b64>.<exp>.<sig>", valid LINK_MINUTES, sent by email
 *   cookie  "s.<email b64>.<exp>.<sig>", valid SESSION_DAYS, httpOnly
 *
 * The cookie only says who someone is. Whether they still have access is
 * checked against the Licences tab on every watch request, so a cancelled
 * licence stops working straight away even with a valid cookie.
 */

export const LICENCE_COOKIE = "asosc_library_session";
const LINK_MINUTES = 30;
const SESSION_DAYS = 30;

function secret(): string {
  const s = process.env.LICENCE_SESSION_SECRET?.trim();
  if (!s) throw new Error("LICENCE_SESSION_SECRET is not configured");
  return s;
}

function sign(payload: string): string {
  return createHmac("sha256", secret()).update(payload).digest("base64url");
}

function make(kind: "l" | "s", email: string, ttlMs: number): string {
  const payload = `${kind}.${Buffer.from(email.trim().toLowerCase()).toString("base64url")}.${Date.now() + ttlMs}`;
  return `${payload}.${sign(payload)}`;
}

function read(kind: "l" | "s", token: string | undefined | null): string | null {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 4 || parts[0] !== kind) return null;
  const [, emailB64, expRaw, sig] = parts;
  const exp = Number(expRaw);
  if (!Number.isFinite(exp) || Date.now() > exp) return null;
  const expected = sign(`${kind}.${emailB64}.${expRaw}`);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  const email = Buffer.from(emailB64, "base64url").toString("utf8");
  return email.includes("@") ? email : null;
}

export const createLinkToken = (email: string) => make("l", email, LINK_MINUTES * 60_000);
export const readLinkToken = (token: string | null) => read("l", token);
export const createSessionToken = (email: string) => make("s", email, SESSION_DAYS * 86_400_000);

/** The signed-in licence holder's email, or null. */
export async function sessionEmail(): Promise<string | null> {
  const jar = await cookies();
  return read("s", jar.get(LICENCE_COOKIE)?.value);
}

export function sessionCookieOptions(maxAge = SESSION_DAYS * 86_400) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge,
  };
}

/** The site's own origin, for links in emails. */
export function siteOrigin(request: Request): string {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (configured) return configured.replace(/\/$/, "");
  return new URL(request.url).origin;
}
