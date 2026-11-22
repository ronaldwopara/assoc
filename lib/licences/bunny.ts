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

// ---------------------------------------------------------------- library management (staff only)
// Env: BUNNY_STREAM_API_KEY (the library's API key — secret, server only).

const API = "https://video.bunnycdn.com/library";

function apiCreds() {
  const library = process.env.BUNNY_LIBRARY_ID?.trim();
  const key = process.env.BUNNY_STREAM_API_KEY?.trim();
  if (!library || !key) throw new Error("Bunny Stream isn't configured (BUNNY_LIBRARY_ID, BUNNY_STREAM_API_KEY)");
  return { library, key };
}

export type BunnyVideo = {
  id: string;
  title: string;
  /** Seconds. */
  length: number;
  /** "ready" once Bunny has finished processing it. */
  state: "ready" | "processing" | "failed";
  createdAt: string;
};

const STATE: Record<number, BunnyVideo["state"]> = { 0: "processing", 1: "processing", 2: "processing", 3: "processing", 4: "ready", 5: "failed", 6: "failed" };

export async function listBunnyVideos(): Promise<BunnyVideo[]> {
  const { library, key } = apiCreds();
  const out: BunnyVideo[] = [];
  for (let page = 1; page <= 10; page++) {
    const res = await fetch(`${API}/${library}/videos?page=${page}&itemsPerPage=100&orderBy=date`, {
      headers: { AccessKey: key, Accept: "application/json" },
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`Bunny list failed (${res.status})`);
    const data = (await res.json()) as {
      totalItems: number;
      items: { guid: string; title: string; length: number; status: number; dateUploaded: string }[];
    };
    for (const v of data.items) {
      out.push({ id: v.guid, title: v.title, length: v.length, state: STATE[v.status] ?? "processing", createdAt: v.dateUploaded });
    }
    if (out.length >= data.totalItems || data.items.length === 0) break;
  }
  return out;
}

/**
 * Makes an empty video and returns what the browser needs to upload the file
 * straight to Bunny over TUS (so big films never pass through our server).
 * Signature = SHA256(library id + API key + expires + video id), per Bunny's TUS docs.
 */
export async function startBunnyUpload(title: string) {
  const { library, key } = apiCreds();
  const res = await fetch(`${API}/${library}/videos`, {
    method: "POST",
    headers: { AccessKey: key, "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ title: title.slice(0, 200) || "Untitled" }),
  });
  if (!res.ok) throw new Error(`Bunny couldn't create the video (${res.status})`);
  const { guid } = (await res.json()) as { guid: string };
  const expires = Math.floor(Date.now() / 1000) + 60 * 60 * 24;
  const signature = createHash("sha256").update(`${library}${key}${expires}${guid}`).digest("hex");
  return { videoId: guid, libraryId: library, expires, signature, endpoint: "https://video.bunnycdn.com/tusupload" };
}
