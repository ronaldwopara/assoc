import type { SiteContent } from "@/lib/site-content/types";

/**
 * Makes stored data match the shape of `template` (the seed): wrong types fall
 * back to the template's value, unknown keys are dropped, and arrays are
 * conformed item by item against the template's first item. Safe on the client.
 */
export function conform<T>(template: T, value: unknown): T {
  if (Array.isArray(template)) {
    if (!Array.isArray(value)) return template;
    const model = template[0];
    if (model === undefined) return value.filter((v) => typeof v === "string").map((v) => String(v).slice(0, 5000)) as T;
    return value.map((v) => conform(model, v)) as T;
  }
  if (template && typeof template === "object") {
    if (!value || typeof value !== "object" || Array.isArray(value)) return template;
    const out: Record<string, unknown> = {};
    for (const [k, t] of Object.entries(template as Record<string, unknown>)) {
      const v = (value as Record<string, unknown>)[k];
      out[k] = v === undefined ? t : conform(t, v);
    }
    return out as T;
  }
  if (typeof template === "string") return (typeof value === "string" ? value.slice(0, 5000) : template) as T;
  if (typeof template === "boolean") return (typeof value === "boolean" ? value : template) as T;
  if (typeof template === "number") return (typeof value === "number" && Number.isFinite(value) ? value : template) as T;
  return template;
}

export function normalizeSiteContent(value: unknown, seed: SiteContent): SiteContent {
  const out = conform(seed, value);
  // The six program tiles keep their fixed places in the grid.
  out.programs.items = seed.programs.items.map(
    (s) => out.programs.items.find((p) => p.area === s.area) ?? s,
  );
  return out;
}

/** "https://youtu.be/ID", ".../watch?v=ID" or an embed link → the embed URL. */
export function youtubeEmbedUrl(link: string): string {
  const m = link.match(/(?:youtu\.be\/|v=|embed\/|shorts\/)([\w-]{6,})/);
  return m ? `https://www.youtube.com/embed/${m[1]}` : "";
}
