import type {
  DocumentsCmsData,
  DocumentsCmsGroup,
  DocumentsCmsItem,
} from "@/lib/documents-cms/types";

function isItem(value: unknown): value is DocumentsCmsItem {
  if (!value || typeof value !== "object") return false;
  const item = value as DocumentsCmsItem;
  return (
    typeof item.id === "string" &&
    typeof item.label === "string" &&
    typeof item.url === "string" &&
    typeof item.filename === "string" &&
    typeof item.contentType === "string"
  );
}

function normalizeItem(item: DocumentsCmsItem): DocumentsCmsItem | null {
  const id = item.id.trim();
  const label = item.label.trim();
  const url = item.url.trim();
  if (!id || !label || !url) return null;
  return {
    id,
    label,
    url,
    filename: item.filename.trim() || label,
    contentType: item.contentType.trim() || "application/octet-stream",
  };
}

function normalizeGroup(group: DocumentsCmsGroup): DocumentsCmsGroup | null {
  const id = typeof group.id === "string" ? group.id.trim() : "";
  const title = typeof group.title === "string" ? group.title.trim() : "";
  if (!id || !title) return null;
  const items = (Array.isArray(group.items) ? group.items : [])
    .filter(isItem)
    .map(normalizeItem)
    .filter((item): item is DocumentsCmsItem => item !== null);
  return { id, title, items };
}

export function normalizeDocumentsCmsData(
  input: unknown,
  fallback?: DocumentsCmsData,
): DocumentsCmsData {
  if (!input || typeof input !== "object") {
    return (
      fallback ?? {
        version: 1,
        updatedAt: new Date().toISOString(),
        groups: [],
      }
    );
  }

  const raw = input as Partial<DocumentsCmsData>;
  const groups = (Array.isArray(raw.groups) ? raw.groups : [])
    .map(normalizeGroup)
    .filter((group): group is DocumentsCmsGroup => group !== null);

  return {
    version: 1,
    updatedAt:
      typeof raw.updatedAt === "string" ? raw.updatedAt : new Date().toISOString(),
    groups: groups.length > 0 ? groups : (fallback?.groups ?? []),
  };
}

export function createDocumentGroupId(title: string): string {
  const base = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return base ? `${base}-${Date.now()}` : `group-${Date.now()}`;
}

export function createDocumentItemId(label: string): string {
  const base = label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return base ? `${base}-${Date.now()}` : `doc-${Date.now()}`;
}

/** All non-empty document URLs currently referenced by the CMS tree. */
export function collectDocumentUrls(data: DocumentsCmsData): string[] {
  const urls: string[] = [];
  for (const group of data.groups) {
    for (const item of group.items) {
      if (item.url) urls.push(item.url);
    }
  }
  return urls;
}

/**
 * Public download href for About Us.
 * Local `/docs/...` seed files stay direct; Cloudinary raw URLs go through
 * our download proxy (Cloudinary blocks unsigned PDF/ZIP delivery by default).
 */
export function toPublicDocumentHref(url: string): string {
  const trimmed = url.trim();
  if (!trimmed) return trimmed;
  if (trimmed.startsWith("/")) return trimmed;
  try {
    const parsed = new URL(trimmed);
    if (
      parsed.hostname === "res.cloudinary.com" &&
      parsed.pathname.includes("/raw/") &&
      parsed.pathname.includes("/asosc/docs/")
    ) {
      return `/api/documents/download?url=${encodeURIComponent(trimmed)}`;
    }
  } catch {
    // fall through
  }
  return trimmed;
}
