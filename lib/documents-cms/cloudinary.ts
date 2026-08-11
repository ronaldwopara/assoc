import { createHash } from "node:crypto";

const CMS_FOLDER = "asosc/cms";
const DOCUMENTS_CMS_PUBLIC_ID = "documents.json";
export const DOCUMENTS_UPLOAD_FOLDER = "asosc/docs";

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

async function uploadRaw(options: {
  publicId: string;
  filename: string;
  folder: string;
  file: Blob;
  resourceType?: "raw" | "auto";
}): Promise<{ version: number; url: string }> {
  const { cloudName, apiKey, apiSecret } = requireCloudinary();
  const timestamp = Math.round(Date.now() / 1000);
  const paramsToSign = {
    folder: options.folder,
    invalidate: 1,
    overwrite: 1,
    public_id: options.publicId,
    timestamp,
  };
  const form = new FormData();
  form.append("file", options.file, options.filename);
  form.append("api_key", apiKey);
  form.append("timestamp", String(timestamp));
  form.append("folder", options.folder);
  form.append("public_id", options.publicId);
  form.append("overwrite", "true");
  form.append("invalidate", "true");
  form.append("signature", sign(paramsToSign, apiSecret));

  const res = await fetch(
    `https://api.cloudinary.com/v1_1/${cloudName}/${options.resourceType ?? "raw"}/upload`,
    { method: "POST", body: form },
  );
  const data = (await res.json()) as {
    version?: number;
    secure_url?: string;
    error?: { message?: string };
  };
  if (!res.ok || !data.secure_url) {
    throw new Error(data.error?.message ?? "Cloudinary upload failed");
  }
  return { version: data.version ?? timestamp, url: data.secure_url };
}

export async function uploadDocumentsCmsJson(
  json: string,
): Promise<{ version: number; url: string }> {
  return uploadRaw({
    folder: CMS_FOLDER,
    publicId: DOCUMENTS_CMS_PUBLIC_ID,
    filename: "documents.json",
    file: new Blob([json], { type: "application/json" }),
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
    throw new Error(data.error?.message ?? "Failed to locate documents CMS file");
  }
  return data.secure_url;
}

export async function fetchDocumentsCmsJsonUrl(): Promise<string | null> {
  return fetchRawJsonUrl(DOCUMENTS_CMS_PUBLIC_ID);
}

export async function uploadDocumentToCloudinary(options: {
  file: Blob;
  filename: string;
  groupId: string;
  publicId: string;
}): Promise<{ secureUrl: string }> {
  const uploaded = await uploadRaw({
    folder: `${DOCUMENTS_UPLOAD_FOLDER}/${options.groupId}`,
    publicId: options.publicId,
    filename: options.filename,
    file: options.file,
  });
  return { secureUrl: uploaded.url };
}

/**
 * Extract a Cloudinary raw public_id from a delivery URL.
 * Only accepts URLs for our cloud + asosc/docs folder so we never
 * destroy seed /public/docs assets or unrelated media.
 */
export function documentPublicIdFromUrl(url: string): string | null {
  if (!url) return null;
  let cloudName: string;
  try {
    cloudName = requireCloudinary().cloudName;
  } catch {
    return null;
  }
  try {
    const parsed = new URL(url);
    if (parsed.hostname !== "res.cloudinary.com") return null;
    if (!parsed.pathname.startsWith(`/${cloudName}/raw/upload/`)) return null;
    const marker = `/${DOCUMENTS_UPLOAD_FOLDER}/`;
    const at = parsed.pathname.indexOf(marker);
    if (at === -1) return null;
    // pathname slice starts with "/" — drop it to get the public_id path
    // (Cloudinary raw public_ids keep their file extension).
    return parsed.pathname.slice(at + 1);
  } catch {
    return null;
  }
}

export async function deleteCloudinaryRawByPublicId(
  publicId: string,
): Promise<boolean> {
  const { cloudName, apiKey, apiSecret } = requireCloudinary();
  const timestamp = Math.round(Date.now() / 1000);
  const paramsToSign = {
    invalidate: 1,
    public_id: publicId,
    timestamp,
  };
  const body = new URLSearchParams();
  body.set("public_id", publicId);
  body.set("invalidate", "1");
  body.set("timestamp", String(timestamp));
  body.set("api_key", apiKey);
  body.set("signature", sign(paramsToSign, apiSecret));

  const res = await fetch(
    `https://api.cloudinary.com/v1_1/${cloudName}/raw/destroy`,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    },
  );
  const data = (await res.json()) as {
    result?: string;
    error?: { message?: string };
  };
  if (data.result === "ok" || data.result === "not found") return true;
  if (!res.ok) {
    throw new Error(data.error?.message ?? `Cloudinary destroy failed for ${publicId}`);
  }
  return data.result === "ok";
}

export async function deleteDocumentUrls(urls: string[]): Promise<{
  deleted: string[];
  failed: { url: string; error: string }[];
  skipped: string[];
}> {
  const unique = [...new Set(urls.filter(Boolean))];
  const deleted: string[] = [];
  const failed: { url: string; error: string }[] = [];
  const skipped: string[] = [];
  for (const url of unique) {
    const publicId = documentPublicIdFromUrl(url);
    if (!publicId) {
      skipped.push(url);
      continue;
    }
    try {
      await deleteCloudinaryRawByPublicId(publicId);
      deleted.push(url);
    } catch (error) {
      failed.push({
        url,
        error: error instanceof Error ? error.message : "Destroy failed",
      });
    }
  }
  return { deleted, failed, skipped };
}

/**
 * Stream a document from Cloudinary via the Admin download API.
 * Required because free/restricted Cloudinary accounts block public PDF/ZIP CDN delivery (401).
 */
export async function downloadDocumentFromCloudinary(publicId: string): Promise<{
  buffer: Buffer;
  contentType: string;
}> {
  const { cloudName, apiKey, apiSecret } = requireCloudinary();
  const timestamp = Math.round(Date.now() / 1000) + 600;
  const paramsToSign = {
    public_id: publicId,
    timestamp,
    type: "upload",
  };
  const body = new URLSearchParams();
  body.set("public_id", publicId);
  body.set("timestamp", String(timestamp));
  body.set("type", "upload");
  body.set("api_key", apiKey);
  body.set("signature", sign(paramsToSign, apiSecret));

  const res = await fetch(
    `https://api.cloudinary.com/v1_1/${cloudName}/raw/download`,
    { method: "POST", body },
  );
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(
      `Cloudinary download failed (${res.status}): ${errText.slice(0, 200)}`,
    );
  }
  const buffer = Buffer.from(await res.arrayBuffer());
  const contentType =
    res.headers.get("content-type") || "application/octet-stream";
  return { buffer, contentType };
}
