import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

export const UPGRADE_COOKIE = "asosc_upgrade_session";
const MAX_AGE_SECONDS = 60 * 60 * 24 * 14; // 14 days

function sessionSecret() {
  const secret =
    process.env.UPGRADE_SESSION_SECRET || process.env.UPGRADE_PASSWORD;
  if (!secret) {
    throw new Error("UPGRADE_PASSWORD is not configured");
  }
  return secret;
}

export function getUpgradePassword() {
  const password = process.env.UPGRADE_PASSWORD;
  if (!password) {
    throw new Error("UPGRADE_PASSWORD is not configured");
  }
  return password;
}

export function passwordsMatch(input: string, expected: string) {
  const a = Buffer.from(input);
  const b = Buffer.from(expected);
  if (a.length !== b.length) {
    // Still run a compare to reduce timing leaks on length.
    timingSafeEqual(a, a);
    return false;
  }
  return timingSafeEqual(a, b);
}

export function createSessionToken() {
  const exp = Date.now() + MAX_AGE_SECONDS * 1000;
  const payload = `ok.${exp}`;
  const sig = createHmac("sha256", sessionSecret())
    .update(payload)
    .digest("base64url");
  return `${payload}.${sig}`;
}

export function verifySessionToken(token: string | undefined) {
  if (!token) return false;
  const parts = token.split(".");
  if (parts.length !== 3) return false;
  const [ok, expRaw, sig] = parts;
  if (ok !== "ok") return false;
  const exp = Number(expRaw);
  if (!Number.isFinite(exp) || Date.now() > exp) return false;
  const payload = `${ok}.${expRaw}`;
  const expected = createHmac("sha256", sessionSecret())
    .update(payload)
    .digest("base64url");
  try {
    return timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
  } catch {
    return false;
  }
}

export async function isUpgradeAuthenticated() {
  const jar = await cookies();
  return verifySessionToken(jar.get(UPGRADE_COOKIE)?.value);
}

export function sessionCookieOptions(maxAge = MAX_AGE_SECONDS) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge,
  };
}
