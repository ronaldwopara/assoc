import { createHash } from "node:crypto";
import {
  deleteCloudinaryImageByPublicId,
} from "@/lib/gallery-cms/cloudinary";

const CMS_FOLDER = "asosc/cms";
const POPUP_CMS_PUBLIC_ID = "popup.json";
export const POPUP_IMAGE_FOLDER = "asosc/popup";

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

export async function uploadPopupCmsJson(
  json: string,
): Promise<{ version: number; url: string }> {
  return uploadRawJson({
    publicId: POPUP_CMS_PUBLIC_ID,
    filename: "popup.json",
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
    throw new Error(data.error?.message ?? "Failed to locate popup CMS file");
  }
  return data.secure_url;
}

export async function fetchPopupCmsJsonUrl(): Promise<string | null> {
  return fetchRawJsonUrl(POPUP_CMS_PUBLIC_ID);
}

export function popupImagePublicIdFromUrl(url: string): string | null {
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
    if (!parsed.pathname.startsWith(`/${cloudName}/image/upload/`)) return null;
    const marker = `/${POPUP_IMAGE_FOLDER}/`;
    const at = parsed.pathname.indexOf(marker);
    if (at === -1) return null;
    const withExt = parsed.pathname.slice(at + 1);
    return withExt.replace(/\.[^.]+$/, "");
  } catch {
    return null;
  }
}

export async function deletePopupImageUrls(urls: string[]): Promise<{
  deleted: string[];
  failed: { url: string; error: string }[];
}> {
  const unique = [...new Set(urls.filter(Boolean))];
  const deleted: string[] = [];
  const failed: { url: string; error: string }[] = [];
  for (const url of unique) {
    const publicId = popupImagePublicIdFromUrl(url);
    if (!publicId) continue;
    try {
      await deleteCloudinaryImageByPublicId(publicId);
      deleted.push(url);
    } catch (error) {
      failed.push({
        url,
        error: error instanceof Error ? error.message : "Destroy failed",
      });
    }
  }
  return { deleted, failed };
}
