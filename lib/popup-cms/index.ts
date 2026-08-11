import { revalidatePath, revalidateTag } from "next/cache";
import {
  deletePopupImageUrls,
  fetchPopupCmsJsonUrl,
  uploadPopupCmsJson,
} from "@/lib/popup-cms/cloudinary";
import {
  collectPopupImageUrls,
  normalizePopupCmsData,
} from "@/lib/popup-cms/helpers";
import { buildSeedPopupCms } from "@/lib/popup-cms/seed";
import type { PopupCmsData } from "@/lib/popup-cms/types";

export const POPUP_CMS_TAG = "popup-cms";

async function readStoredCms(options?: {
  cache?: RequestCache;
}): Promise<PopupCmsData | null> {
  try {
    const url = await fetchPopupCmsJsonUrl();
    if (!url) return null;
    const res = await fetch(
      url,
      options?.cache === "no-store"
        ? { cache: "no-store" }
        : { next: { tags: [POPUP_CMS_TAG], revalidate: 30 } },
    );
    if (!res.ok) return null;
    const json = await res.json();
    return normalizePopupCmsData(json, buildSeedPopupCms());
  } catch {
    return null;
  }
}

export async function getPopupCmsData(): Promise<PopupCmsData> {
  const stored = await readStoredCms();
  return stored ?? buildSeedPopupCms();
}

export async function savePopupCmsData(data: PopupCmsData) {
  const previous =
    (await readStoredCms({ cache: "no-store" })) ?? buildSeedPopupCms();
  const normalized = normalizePopupCmsData(
    {
      ...data,
      updatedAt: new Date().toISOString(),
    },
    buildSeedPopupCms(),
  );

  const previousUrls = new Set(collectPopupImageUrls(previous));
  const nextUrls = new Set(collectPopupImageUrls(normalized));
  const removedUrls = [...previousUrls].filter((url) => !nextUrls.has(url));

  await uploadPopupCmsJson(JSON.stringify(normalized));

  if (removedUrls.length > 0) {
    const result = await deletePopupImageUrls(removedUrls);
    if (result.failed.length > 0) {
      console.error("Cloudinary cleanup after popup save:", result.failed);
    }
  }

  revalidateTag(POPUP_CMS_TAG, { expire: 0 });
  revalidatePath("/");
  return normalized;
}
