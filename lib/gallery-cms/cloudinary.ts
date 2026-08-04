import { createHash } from "node:crypto";

const GALLERY_PREVIEW_QUALITY = 75;
const GALLERY_PREVIEW_MAX_WIDTH = 1600;

function requireCloudinary() {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;
  if (!cloudName || !apiKey || !apiSecret) {
    throw new Error("Missing Cloudinary env vars");
  }
  return { cloudName, apiKey, apiSecret };
}

function sign(params: Record<string, string | number>, apiSecret: string) {
  const signatureBase = Object.keys(params)
    .sort()
    .map((key) => `${key}=${params[key]}`)
    .join("&");
  return createHash("sha1")
    .update(signatureBase + apiSecret)
    .digest("hex");
}

export async function uploadImageToCloudinary(options: {
  file: Blob;
  filename: string;
  folder: string;
  publicId: string;
}): Promise<{ secureUrl: string; width: number; height: number }> {
  const { cloudName, apiKey, apiSecret } = requireCloudinary();

  // Lazy-loaded: sharp pulls in a native binary. A top-level import here
  // would bundle it into every route that transitively imports this module
  // (including the root layout, via getGalleryCmsData) — this function is
  // the only thing that actually needs it.
  const sharp = (await import("sharp")).default;
  const inputBuffer = Buffer.from(await options.file.arrayBuffer());
  let pipeline = sharp(inputBuffer).rotate();
  const meta = await pipeline.metadata();
  if (meta.width && meta.width > GALLERY_PREVIEW_MAX_WIDTH) {
    pipeline = pipeline.resize({
      width: GALLERY_PREVIEW_MAX_WIDTH,
      withoutEnlargement: true,
    });
  }
  const optimized = await pipeline
    .webp({ quality: GALLERY_PREVIEW_QUALITY, effort: 6 })
    .toBuffer();
  const optimizedFilename = options.filename.replace(/\.[^.]+$/, "") + ".webp";

  const timestamp = Math.round(Date.now() / 1000);
  const paramsToSign = {
    folder: options.folder,
    public_id: options.publicId,
    timestamp,
  };
  const form = new FormData();
  form.append(
    "file",
    new Blob([new Uint8Array(optimized)], { type: "image/webp" }),
    optimizedFilename,
  );
  form.append("api_key", apiKey);
  form.append("timestamp", String(timestamp));
  form.append("folder", options.folder);
  form.append("public_id", options.publicId);
  form.append("signature", sign(paramsToSign, apiSecret));

  const res = await fetch(
    `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
    { method: "POST", body: form },
  );
  const data = (await res.json()) as {
    secure_url?: string;
    width?: number;
    height?: number;
    error?: { message?: string };
  };
  if (!res.ok || !data.secure_url) {
    throw new Error(data.error?.message ?? "Cloudinary image upload failed");
  }
  return {
    secureUrl: data.secure_url,
    width: data.width ?? 16,
    height: data.height ?? 9,
  };
}

const CMS_FOLDER = "asosc/cms";
// Cloudinary appends the source filename's extension to the public_id for
// raw uploads regardless of the public_id you request, so the stored asset
// is actually "gallery.json" — the lookup path must match that exactly or
// every read 404s and silently falls back to the seed data.
const CMS_PUBLIC_ID = "gallery.json";
const GOOGLE_TOKENS_PUBLIC_ID = "google-tokens.json";

async function uploadRawJson(options: {
  publicId: string;
  filename: string;
  json: string;
}): Promise<{ version: number; url: string }> {
  const { cloudName, apiKey, apiSecret } = requireCloudinary();
  const timestamp = Math.round(Date.now() / 1000);
  const paramsToSign = {
    folder: CMS_FOLDER,
    invalidate: 1,
    overwrite: 1,
    public_id: options.publicId,
    timestamp,
  };
  const form = new FormData();
  form.append(
    "file",
    new Blob([options.json], { type: "application/json" }),
    options.filename,
  );
  form.append("api_key", apiKey);
  form.append("timestamp", String(timestamp));
  form.append("folder", CMS_FOLDER);
  form.append("public_id", options.publicId);
  form.append("overwrite", "true");
  form.append("invalidate", "true");
  form.append("signature", sign(paramsToSign, apiSecret));

  const res = await fetch(
    `https://api.cloudinary.com/v1_1/${cloudName}/raw/upload`,
    { method: "POST", body: form },
  );
  const data = (await res.json()) as {
    version?: number;
    secure_url?: string;
    error?: { message?: string };
  };
  if (!res.ok || !data.secure_url) {
    throw new Error(data.error?.message ?? "Cloudinary CMS upload failed");
  }
  return { version: data.version ?? timestamp, url: data.secure_url };
}

export async function uploadCmsJson(json: string): Promise<{ version: number; url: string }> {
  return uploadRawJson({
    publicId: CMS_PUBLIC_ID,
    filename: "gallery.json",
    json,
  });
}

async function fetchRawJsonUrl(publicId: string): Promise<string | null> {
  const { cloudName, apiKey, apiSecret } = requireCloudinary();
  const auth = Buffer.from(`${apiKey}:${apiSecret}`).toString("base64");
  const res = await fetch(
    `https://api.cloudinary.com/v1_1/${cloudName}/resources/raw/upload/${encodeURIComponent(`${CMS_FOLDER}/${publicId}`)}`,
    {
      headers: { Authorization: `Basic ${auth}` },
      cache: "no-store",
    },
  );
  if (res.status === 404) return null;
  const data = (await res.json()) as {
    secure_url?: string;
    error?: { message?: string };
  };
  if (!res.ok || !data.secure_url) {
    if (res.status === 404) return null;
    throw new Error(data.error?.message ?? "Failed to locate CMS file");
  }
  return data.secure_url;
}

export async function fetchCmsJsonUrl(): Promise<string | null> {
  return fetchRawJsonUrl(CMS_PUBLIC_ID);
}

/** Encrypted Google OAuth token blob (same Cloudinary CMS folder as gallery). */
export async function uploadGoogleTokensJson(
  json: string,
): Promise<{ version: number; url: string }> {
  return uploadRawJson({
    publicId: GOOGLE_TOKENS_PUBLIC_ID,
    filename: "google-tokens.json",
    json,
  });
}

export async function fetchGoogleTokensJsonUrl(): Promise<string | null> {
  return fetchRawJsonUrl(GOOGLE_TOKENS_PUBLIC_ID);
}
