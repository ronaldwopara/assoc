import { revalidatePath, revalidateTag } from "next/cache";
import { fetchRawJsonUrl, uploadRawJson } from "@/lib/popup-cms/cloudinary";
import { buildSeedSiteContent } from "@/lib/site-content/seed";
import { normalizeSiteContent } from "@/lib/site-content/normalize";
import type { SiteContent } from "@/lib/site-content/types";

/** Site text and pictures staff edit under Upgrade → Site sections (a JSON file in Cloudinary). */

export const SITE_CONTENT_TAG = "site-content";
export const SITE_MEDIA_FOLDER = "asosc/site";
const PUBLIC_ID = "site-content.json";

async function readStored(fresh?: boolean): Promise<SiteContent | null> {
  try {
    const url = await fetchRawJsonUrl(PUBLIC_ID);
    if (!url) return null;
    const res = await fetch(url, fresh ? { cache: "no-store" } : { next: { tags: [SITE_CONTENT_TAG], revalidate: 60 } });
    if (!res.ok) return null;
    return normalizeSiteContent(await res.json(), buildSeedSiteContent());
  } catch {
    return null;
  }
}

export async function getSiteContent(fresh?: boolean): Promise<SiteContent> {
  return (await readStored(fresh)) ?? buildSeedSiteContent();
}

export async function saveSiteContent(value: unknown): Promise<SiteContent> {
  const next = normalizeSiteContent(value, buildSeedSiteContent());
  next.updatedAt = new Date().toISOString();
  await uploadRawJson({ publicId: PUBLIC_ID, filename: PUBLIC_ID, json: JSON.stringify(next) });
  revalidateTag(SITE_CONTENT_TAG, { expire: 0 });
  revalidatePath("/", "layout");
  return next;
}
