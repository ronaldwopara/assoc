import { createHash } from "node:crypto";

/**
 * Signed Bunny Stream embed URLs.
 *
 * The library must have "Embed view token authentication" switched on, and
 * asosc.ca / www.asosc.ca / localhost in its allowed referrers. The token is
 * SHA256_HEX(token key + video id + expires), per Bunny's embed token docs.
 *
 * Env: BUNNY_LIBRARY_ID, BUNNY_TOKEN_KEY (the library's token authentication
 * key — secret, server only).
 */

const EMBED_ORIGIN = "https://iframe.mediadelivery.net";
const DEFAULT_TTL_SECONDS = 60 * 60 * 4;

export function bunnyConfigured(): boolean {
  return Boolean(process.env.BUNNY_LIBRARY_ID?.trim() && process.env.BUNNY_TOKEN_KEY?.trim());
}

export function signedEmbedUrl(videoId: string, ttlSeconds = DEFAULT_TTL_SECONDS): string {
  const library = process.env.BUNNY_LIBRARY_ID?.trim();
  const key = process.env.BUNNY_TOKEN_KEY?.trim();
  if (!library || !key) throw new Error("Bunny Stream isn't configured (BUNNY_LIBRARY_ID, BUNNY_TOKEN_KEY)");

  const expires = Math.floor(Date.now() / 1000) + ttlSeconds;
  const token = createHash("sha256").update(`${key}${videoId}${expires}`).digest("hex");
  const url = new URL(`${EMBED_ORIGIN}/embed/${encodeURIComponent(library)}/${encodeURIComponent(videoId)}`);
  url.searchParams.set("token", token);
  url.searchParams.set("expires", String(expires));
  url.searchParams.set("autoplay", "true");
  url.searchParams.set("responsive", "true");
  return url.toString();
}
