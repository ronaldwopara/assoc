import { createHash, randomBytes } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export const GOOGLE_OAUTH_SCOPES = [
  "openid",
  "https://www.googleapis.com/auth/userinfo.email",
  "https://www.googleapis.com/auth/userinfo.profile",
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/drive.file",
  "https://www.googleapis.com/auth/spreadsheets",
] as const;

export const GOOGLE_OAUTH_STATE_COOKIE = "asosc_google_oauth_state";

const TOKEN_PATH = path.join(process.cwd(), ".data", "google-tokens.json");

type StoredGoogleTokens = {
  refreshToken: string;
  accessToken?: string;
  expiryDate?: number;
  email?: string;
  scope?: string;
  updatedAt: string;
};

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} is not configured`);
  }
  return value;
}

export function getGoogleOAuthConfig() {
  return {
    clientId: requireEnv("GOOGLE_CLIENT_ID"),
    clientSecret: requireEnv("GOOGLE_CLIENT_SECRET"),
    redirectUri: requireEnv("GOOGLE_REDIRECT_URI"),
  };
}

export function createOAuthState() {
  return randomBytes(24).toString("base64url");
}

export function buildGoogleAuthUrl(state: string) {
  const { clientId, redirectUri } = getGoogleOAuthConfig();
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", GOOGLE_OAUTH_SCOPES.join(" "));
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("prompt", "consent");
  url.searchParams.set("include_granted_scopes", "true");
  url.searchParams.set("state", state);
  return url.toString();
}

export async function exchangeCodeForTokens(code: string) {
  const { clientId, clientSecret, redirectUri } = getGoogleOAuthConfig();

  const body = new URLSearchParams({
    code,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: redirectUri,
    grant_type: "authorization_code",
  });

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  const payload = (await response.json()) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
    scope?: string;
    error?: string;
    error_description?: string;
  };

  if (!response.ok || !payload.access_token) {
    throw new Error(
      payload.error_description || payload.error || "Failed to exchange Google auth code",
    );
  }

  return {
    accessToken: payload.access_token,
    refreshToken: payload.refresh_token,
    expiryDate: payload.expires_in
      ? Date.now() + payload.expires_in * 1000
      : undefined,
    scope: payload.scope,
  };
}

export async function fetchGoogleAccountEmail(accessToken: string) {
  const response = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  const payload = (await response.json()) as {
    email?: string;
    error?: { message?: string };
  };

  if (!response.ok || !payload.email) {
    throw new Error(payload.error?.message || "Failed to load Google account email");
  }

  return payload.email;
}

export async function saveGoogleTokens(tokens: {
  refreshToken: string;
  accessToken?: string;
  expiryDate?: number;
  email?: string;
  scope?: string;
}) {
  await mkdir(path.dirname(TOKEN_PATH), { recursive: true });

  const existing = await readGoogleTokens();
  const next: StoredGoogleTokens = {
    refreshToken: tokens.refreshToken || existing?.refreshToken || "",
    accessToken: tokens.accessToken ?? existing?.accessToken,
    expiryDate: tokens.expiryDate ?? existing?.expiryDate,
    email: tokens.email ?? existing?.email,
    scope: tokens.scope ?? existing?.scope,
    updatedAt: new Date().toISOString(),
  };

  if (!next.refreshToken) {
    throw new Error("No refresh token returned. Reconnect with prompt=consent.");
  }

  await writeFile(TOKEN_PATH, JSON.stringify(next, null, 2), "utf8");
  return next;
}

export async function readGoogleTokens(): Promise<StoredGoogleTokens | null> {
  try {
    const raw = await readFile(TOKEN_PATH, "utf8");
    return JSON.parse(raw) as StoredGoogleTokens;
  } catch {
    return null;
  }
}

export async function getGoogleConnectionStatus() {
  const tokens = await readGoogleTokens();
  if (!tokens?.refreshToken) {
    return { connected: false as const };
  }

  return {
    connected: true as const,
    email: tokens.email ?? null,
    updatedAt: tokens.updatedAt,
    fingerprint: createHash("sha256").update(tokens.refreshToken).digest("hex").slice(0, 12),
  };
}

export function oauthStateCookieOptions(maxAgeSeconds = 60 * 10) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: maxAgeSeconds,
  };
}
