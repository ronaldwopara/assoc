import { revalidatePath, revalidateTag } from "next/cache";
import {
  deleteGalleryPreviewUrls,
  fetchCmsJsonUrl,
  uploadCmsJson,
} from "@/lib/gallery-cms/cloudinary";
import {
  collectGalleryImageUrls,
  normalizeGalleryCmsData,
} from "@/lib/gallery-cms/helpers";
import { buildSeedGalleryCms } from "@/lib/gallery-cms/seed";
import type { GalleryCmsData } from "@/lib/gallery-cms/types";

export const GALLERY_CMS_TAG = "gallery-cms";

async function readStoredCms(options?: {
  cache?: RequestCache;
}): Promise<GalleryCmsData | null> {
  try {
    const url = await fetchCmsJsonUrl();
    if (!url) return null;
    const res = await fetch(
      url,
      options?.cache === "no-store"
        ? { cache: "no-store" }
        : { next: { tags: [GALLERY_CMS_TAG], revalidate: 30 } },
    );
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
  const previous =
    (await readStoredCms({ cache: "no-store" })) ?? buildSeedGalleryCms();
  const normalized = normalizeGalleryCmsData(
    {
      ...data,
      updatedAt: new Date().toISOString(),
    },
    buildSeedGalleryCms(),
  );

  const previousUrls = new Set(collectGalleryImageUrls(previous));
  const nextUrls = new Set(collectGalleryImageUrls(normalized));
  const removedUrls = [...previousUrls].filter((url) => !nextUrls.has(url));

  await uploadCmsJson(JSON.stringify(normalized));

  // Best-effort: CMS JSON is already saved. Cloudinary cleanup should not
  // roll back a successful save if destroy fails (e.g. already gone).
  if (removedUrls.length > 0) {
    const result = await deleteGalleryPreviewUrls(removedUrls);
    if (result.failed.length > 0) {
      console.error("Cloudinary cleanup after gallery save:", result.failed);
    }
  }

  // { expire: 0 } forces immediate invalidation. The string profile "max"
  // (Next 16's cache-life shorthand) only schedules a lazy background
  // revalidation, so saves could keep serving stale content afterward.
  revalidateTag(GALLERY_CMS_TAG, { expire: 0 });
  revalidatePath("/gallery");
  revalidatePath("/");
  return normalized;
}
