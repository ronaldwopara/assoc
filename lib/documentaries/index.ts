import { revalidatePath, revalidateTag } from "next/cache";
import { SEED_STORIES, type Story } from "@/lib/licences/catalogue";
import { deleteCloudinaryImageByPublicId } from "@/lib/gallery-cms/cloudinary";
import { fetchRawJsonUrl, uploadRawJson } from "@/lib/popup-cms/cloudinary";
import { normalizeDocumentaries } from "@/lib/documentaries/normalize";

/**
 * The documentaries a licence opens. Staff edit them under Upgrade →
 * Documentaries; the list is a JSON file in Cloudinary, like the popup and
 * documents. Until the first save, SEED_STORIES is used.
 */

export const DOCUMENTARIES_TAG = "documentaries-cms";
export const DOCUMENTARY_COVER_FOLDER = "asosc/documentaries";
const PUBLIC_ID = "documentaries.json";

export type DocumentariesData = { updatedAt: string; items: Story[] };

const seed = (): DocumentariesData => ({ updatedAt: new Date(0).toISOString(), items: SEED_STORIES });

async function readStored(fresh?: boolean): Promise<DocumentariesData | null> {
  try {
    const url = await fetchRawJsonUrl(PUBLIC_ID);
    if (!url) return null;
    const res = await fetch(url, fresh ? { cache: "no-store" } : { next: { tags: [DOCUMENTARIES_TAG], revalidate: 30 } });
    if (!res.ok) return null;
    const json = (await res.json()) as Partial<DocumentariesData>;
    return { updatedAt: typeof json.updatedAt === "string" ? json.updatedAt : "", items: normalizeDocumentaries(json.items) };
  } catch {
    return null;
  }
}

/** Everything, hidden ones included (for the editor and the watch check). */
export async function getDocumentaries(fresh?: boolean): Promise<DocumentariesData> {
  return (await readStored(fresh)) ?? seed();
}

/** What the Stories page shows, in order. */
export async function getPublishedDocumentaries(): Promise<Story[]> {
  return (await getDocumentaries()).items.filter((d) => d.published);
}

export async function documentaryById(id: string): Promise<Story | undefined> {
  return (await getDocumentaries()).items.find((d) => d.id === id);
}

function coverPublicId(url: string): string | null {
  try {
    const { hostname, pathname } = new URL(url);
    if (hostname !== "res.cloudinary.com") return null;
    const at = pathname.indexOf(`/${DOCUMENTARY_COVER_FOLDER}/`);
    return at === -1 ? null : pathname.slice(at + 1).replace(/\.[^.]+$/, "");
  } catch {
    return null;
  }
}

export async function saveDocumentaries(items: unknown): Promise<DocumentariesData> {
  const previous = await getDocumentaries(true);
  const next: DocumentariesData = { updatedAt: new Date().toISOString(), items: normalizeDocumentaries(items) };
  await uploadRawJson({ publicId: PUBLIC_ID, filename: PUBLIC_ID, json: JSON.stringify(next) });

  // Covers that were replaced or whose documentary was removed. Videos stay in Bunny.
  const kept = new Set(next.items.map((d) => d.cover));
  for (const old of previous.items) {
    if (kept.has(old.cover)) continue;
    const id = coverPublicId(old.cover);
    if (id) await deleteCloudinaryImageByPublicId(id).catch((e) => console.error("Cover cleanup:", e));
  }

  revalidateTag(DOCUMENTARIES_TAG, { expire: 0 });
  revalidatePath("/stories");
  return next;
}
