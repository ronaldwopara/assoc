import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import {
  fetchGoogleTokensJsonUrl,
  uploadGoogleTokensJson,
} from "@/lib/gallery-cms/cloudinary";

export const GOOGLE_OAUTH_SCOPES = [
  "openid",
  "https://www.googleapis.com/auth/userinfo.email",
  "https://www.googleapis.com/auth/userinfo.profile",
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/drive.file",
  "https://www.googleapis.com/auth/spreadsheets",
] as const;

export const GOOGLE_OAUTH_STATE_COOKIE = "asosc_google_oauth_state";

type StoredGoogleAccount = {
  id: string;
  email: string;
  refreshToken: string;
  scope?: string;
  updatedAt: string;
};

type EncryptedBlob = {
  iv: string;
  tag: string;
  ciphertext: string;
};

type CloudinaryAccountRecord = {
  id: string;
  email: EncryptedBlob;
  refreshToken: EncryptedBlob;
  scope?: string;
  updatedAt: string;
};

type CloudinaryTokenStoreV2 = {
  v: 2;
  accounts: CloudinaryAccountRecord[];
};

/** Legacy single-account blob (pre multi-account + email encryption). */
type CloudinaryTokenRecordV1 = {
  v: 1;
  email?: string;
  scope?: string;
  updatedAt: string;
  expiryDate?: number;
  refreshToken: EncryptedBlob;
};

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} is not configured`);
  }
  return value;
}

function tokenEncryptionKey() {
  return createHash("sha256").update(requireEnv("GOOGLE_TOKEN_SECRET")).digest();
}

function accountIdForEmail(email: string) {
  return createHash("sha256").update(email.trim().toLowerCase()).digest("hex").slice(0, 16);
}

function encryptSecret(plaintext: string): EncryptedBlob {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", tokenEncryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return {
    iv: iv.toString("base64"),
    tag: tag.toString("base64"),
    ciphertext: ciphertext.toString("base64"),
  };
}

function decryptSecret(blob: EncryptedBlob): string {
  const decipher = createDecipheriv(
    "aes-256-gcm",
    tokenEncryptionKey(),
    Buffer.from(blob.iv, "base64"),
  );
  decipher.setAuthTag(Buffer.from(blob.tag, "base64"));
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(blob.ciphertext, "base64")),
    decipher.final(),
  ]);
  return plaintext.toString("utf8");
}

function decodeStore(raw: unknown): StoredGoogleAccount[] {
  if (!raw || typeof raw !== "object") return [];

  const record = raw as CloudinaryTokenStoreV2 | CloudinaryTokenRecordV1;

  if (record.v === 2 && Array.isArray(record.accounts)) {
    return record.accounts.map((account) => ({
      id: account.id,
      email: decryptSecret(account.email),
      refreshToken: decryptSecret(account.refreshToken),
      scope: account.scope,
      updatedAt: account.updatedAt,
    }));
  }

  if (record.v === 1 && record.refreshToken) {
    const email = record.email?.trim();
    if (!email) return [];
    return [
      {
        id: accountIdForEmail(email),
        email,
        refreshToken: decryptSecret(record.refreshToken),
        scope: record.scope,
        updatedAt: record.updatedAt,
      },
    ];
  }

  return [];
}

async function loadAccounts(): Promise<StoredGoogleAccount[]> {
  try {
    const url = await fetchGoogleTokensJsonUrl();
    if (!url) return [];
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return [];
    return decodeStore(await res.json());
  } catch {
    return [];
  }
}

async function persistAccounts(accounts: StoredGoogleAccount[]) {
  const store: CloudinaryTokenStoreV2 = {
    v: 2,
    accounts: accounts.map((account) => ({
      id: account.id,
      email: encryptSecret(account.email),
      refreshToken: encryptSecret(account.refreshToken),
      scope: account.scope,
      updatedAt: account.updatedAt,
    })),
  };
  await uploadGoogleTokensJson(JSON.stringify(store));
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

/** Upsert one Google account; other linked accounts are kept. */
export async function saveGoogleTokens(tokens: {
  refreshToken: string;
  email: string;
  scope?: string;
}) {
  const email = tokens.email.trim().toLowerCase();
  if (!email) {
    throw new Error("Google account email is required.");
  }
  if (!tokens.refreshToken) {
    throw new Error("No refresh token returned. Reconnect with prompt=consent.");
  }

  const id = accountIdForEmail(email);
  const existing = await loadAccounts();
  const nextAccount: StoredGoogleAccount = {
    id,
    email,
    refreshToken: tokens.refreshToken,
    scope: tokens.scope,
    updatedAt: new Date().toISOString(),
  };

  const accounts = [...existing.filter((account) => account.id !== id), nextAccount];
  await persistAccounts(accounts);
  return nextAccount;
}

export async function listGoogleAccounts(): Promise<StoredGoogleAccount[]> {
  return loadAccounts();
}

export async function getGoogleConnectionStatus() {
  const accounts = await listGoogleAccounts();
  if (accounts.length === 0) {
    return { connected: false as const, count: 0, accounts: [] as const };
  }

  return {
    connected: true as const,
    count: accounts.length,
    accounts: accounts.map((account) => ({
      email: account.email,
      updatedAt: account.updatedAt,
      fingerprint: createHash("sha256").update(account.refreshToken).digest("hex").slice(0, 12),
    })),
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
