import type { Story } from "@/lib/licences/catalogue";

/** Safe on the client: used by the editor and on save. */

const str = (v: unknown, max = 2000) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const BUNNY_ID = /^[0-9a-f-]{36}$/i;

export function newDocumentaryId(): string {
  return `doc-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

export function blankDocumentary(): Story {
  return {
    id: newDocumentaryId(),
    title: "",
    theme: "Our Story, Our Voice documentary",
    summary: "",
    hook: "",
    cover: "",
    videoId: "",
    trailerId: "",
    published: false,
  };
}

export function normalizeDocumentaries(input: unknown): Story[] {
  if (!Array.isArray(input)) return [];
  const seen = new Set<string>();
  const out: Story[] = [];
  for (const raw of input) {
    if (!raw || typeof raw !== "object") continue;
    const r = raw as Record<string, unknown>;
    let id = str(r.id, 80).replace(/[^a-z0-9-]/gi, "");
    if (!id || seen.has(id)) id = newDocumentaryId();
    seen.add(id);
    const videoId = str(r.videoId, 40);
    const trailerId = str(r.trailerId, 40);
    const item: Story = {
      id,
      title: str(r.title, 120),
      theme: str(r.theme, 120),
      summary: str(r.summary, 300),
      hook: str(r.hook, 2000),
      cover: str(r.cover, 500),
      videoId: BUNNY_ID.test(videoId) ? videoId : "",
      trailerId: BUNNY_ID.test(trailerId) ? trailerId : "",
      published: r.published === true,
    };
    // Only a complete documentary can be switched on.
    if (item.published && documentaryProblem(item)) item.published = false;
    out.push(item);
  }
  return out;
}

/** Why a documentary can't be shown yet, or null when it's ready. */
export function documentaryProblem(d: Story): string | null {
  if (!d.title) return "Add a title";
  if (!d.cover) return "Add a cover picture";
  if (!d.videoId) return "Choose the film";
  if (!d.summary) return "Add a one-line summary";
  return null;
}
