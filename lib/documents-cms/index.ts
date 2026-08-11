import { revalidatePath, revalidateTag } from "next/cache";
import {
  deleteDocumentUrls,
  fetchDocumentsCmsJsonUrl,
  uploadDocumentsCmsJson,
} from "@/lib/documents-cms/cloudinary";
import {
  collectDocumentUrls,
  normalizeDocumentsCmsData,
} from "@/lib/documents-cms/helpers";
import { buildSeedDocumentsCms } from "@/lib/documents-cms/seed";
import type { DocumentsCmsData } from "@/lib/documents-cms/types";

export const DOCUMENTS_CMS_TAG = "documents-cms";

async function readStoredCms(options?: {
  cache?: RequestCache;
}): Promise<DocumentsCmsData | null> {
  try {
    const url = await fetchDocumentsCmsJsonUrl();
    if (!url) return null;
    const res = await fetch(
      url,
      options?.cache === "no-store"
        ? { cache: "no-store" }
        : { next: { tags: [DOCUMENTS_CMS_TAG], revalidate: 30 } },
    );
    if (!res.ok) return null;
    const json = await res.json();
    return normalizeDocumentsCmsData(json, buildSeedDocumentsCms());
  } catch {
    return null;
  }
}

export async function getDocumentsCmsData(): Promise<DocumentsCmsData> {
  const stored = await readStoredCms();
  return stored ?? buildSeedDocumentsCms();
}

export async function saveDocumentsCmsData(data: DocumentsCmsData) {
  const previous =
    (await readStoredCms({ cache: "no-store" })) ?? buildSeedDocumentsCms();
  const normalized = normalizeDocumentsCmsData(
    {
      ...data,
      updatedAt: new Date().toISOString(),
    },
    buildSeedDocumentsCms(),
  );

  const previousUrls = new Set(collectDocumentUrls(previous));
  const nextUrls = new Set(collectDocumentUrls(normalized));
  const removedUrls = [...previousUrls].filter((url) => !nextUrls.has(url));

  await uploadDocumentsCmsJson(JSON.stringify(normalized));

  // Best-effort: CMS JSON is already saved. Cloudinary cleanup should not
  // roll back a successful save if destroy fails (e.g. already gone).
  // Local /docs/... seed URLs are skipped by deleteDocumentUrls.
  if (removedUrls.length > 0) {
    const result = await deleteDocumentUrls(removedUrls);
    if (result.failed.length > 0) {
      console.error("Cloudinary cleanup after documents save:", result.failed);
    }
  }

  revalidateTag(DOCUMENTS_CMS_TAG, { expire: 0 });
  revalidatePath("/about");
  return normalized;
}
