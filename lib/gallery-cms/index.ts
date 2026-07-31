import { revalidatePath, revalidateTag } from "next/cache";
import { fetchCmsJsonUrl, uploadCmsJson } from "@/lib/gallery-cms/cloudinary";
import { normalizeGalleryCmsData } from "@/lib/gallery-cms/helpers";
import { buildSeedGalleryCms } from "@/lib/gallery-cms/seed";
import type { GalleryCmsData } from "@/lib/gallery-cms/types";

export const GALLERY_CMS_TAG = "gallery-cms";

async function readStoredCms(): Promise<GalleryCmsData | null> {
  try {
    const url = await fetchCmsJsonUrl();
    if (!url) return null;
    const res = await fetch(url, {
      next: { tags: [GALLERY_CMS_TAG], revalidate: 30 },
    });
    if (!res.ok) return null;
    const json = await res.json();
    return normalizeGalleryCmsData(json, buildSeedGalleryCms());
  } catch {
    return null;
  }
}

export async function getGalleryCmsData(): Promise<GalleryCmsData> {
  const stored = await readStoredCms();
  return stored ?? buildSeedGalleryCms();
}

export async function saveGalleryCmsData(data: GalleryCmsData) {
  const normalized = normalizeGalleryCmsData(
    {
      ...data,
      updatedAt: new Date().toISOString(),
    },
    buildSeedGalleryCms(),
  );
  await uploadCmsJson(JSON.stringify(normalized));
  // { expire: 0 } forces immediate invalidation. The string profile "max"
  // (Next 16's cache-life shorthand) only schedules a lazy background
  // revalidation, so saves could keep serving stale content afterward.
  revalidateTag(GALLERY_CMS_TAG, { expire: 0 });
  revalidatePath("/gallery");
  revalidatePath("/");
  return normalized;
}
