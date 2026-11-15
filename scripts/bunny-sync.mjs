/**
 * Finds the Bunny Stream video ids for the animated stories and writes them
 * into lib/licences/catalogue.ts, so nobody has to copy ids by hand.
 *
 * Needs, in .env.local:
 *   BUNNY_LIBRARY_ID        the Stream library's id
 *   BUNNY_STREAM_API_KEY    the library's API key (Stream → library → API).
 *                           Only used by this script, never by the website.
 *
 * Usage:
 *   npm run bunny:sync            show what it found, change nothing
 *   npm run bunny:sync -- --write also update lib/licences/catalogue.ts
 *
 * Matching: a video whose title contains the story's title is that story's
 * film; if its title also says "trailer" it is the trailer. Anything it can't
 * match is listed so it can be renamed in Bunny or pasted in by hand.
 */
import { readFile, writeFile } from "node:fs/promises";

const CATALOGUE = new URL("../lib/licences/catalogue.ts", import.meta.url);
const library = process.env.BUNNY_LIBRARY_ID?.trim();
const apiKey = process.env.BUNNY_STREAM_API_KEY?.trim();
const write = process.argv.includes("--write");

if (!library || !apiKey) {
  console.error("Set BUNNY_LIBRARY_ID and BUNNY_STREAM_API_KEY in .env.local first.");
  process.exit(1);
}

const norm = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

async function listVideos() {
  const all = [];
  for (let page = 1; page < 50; page++) {
    const url = `https://video.bunnycdn.com/library/${encodeURIComponent(library)}/videos?page=${page}&itemsPerPage=100&orderBy=date`;
    const res = await fetch(url, { headers: { AccessKey: apiKey, accept: "application/json" } });
    if (!res.ok) throw new Error(`Bunny said ${res.status}: ${(await res.text()).slice(0, 200)}`);
    const body = await res.json();
    all.push(...(body.items ?? []));
    if (all.length >= (body.totalItems ?? 0) || !(body.items ?? []).length) break;
  }
  return all;
}

const source = await readFile(CATALOGUE, "utf8");
const stories = [...source.matchAll(/id: "([a-z0-9-]+)",\s*\n\s*title: "([^"]+)"/g)].map(([, id, title]) => ({ id, title }));
const videos = await listVideos();
console.log(`Found ${videos.length} video(s) in library ${library}.\n`);

const used = new Set();
const found = {};
for (const s of stories) {
  const want = norm(s.title);
  const hits = videos.filter((v) => norm(v.title ?? "").includes(want));
  const trailer = hits.find((v) => /trailer/i.test(v.title ?? ""));
  const film = hits.find((v) => !/trailer/i.test(v.title ?? ""));
  found[s.id] = { videoId: film?.guid ?? "", trailerId: trailer?.guid ?? "" };
  for (const v of [film, trailer]) if (v) used.add(v.guid);
  console.log(`${s.title}`);
  console.log(`  film:    ${film ? `${film.guid}  (${film.title})` : "— not found"}`);
  console.log(`  trailer: ${trailer ? `${trailer.guid}  (${trailer.title})` : "— none"}`);
}

const leftover = videos.filter((v) => !used.has(v.guid));
if (leftover.length) {
  console.log("\nNot matched to a story:");
  for (const v of leftover) console.log(`  ${v.guid}  ${v.title}`);
}

if (!write) {
  console.log("\nNothing changed. Run with --write to save these ids.");
  process.exit(0);
}

let next = source;
for (const [id, ids] of Object.entries(found)) {
  // Only overwrite when both were found, so a rename in Bunny never blanks a working id.
  if (!ids.videoId || !ids.trailerId) {
    console.log(`Skipped ${id}: not every id was found, kept what is in the catalogue.`);
    continue;
  }
  const block = new RegExp(`(id: "${id}",[\\s\\S]*?videoId: )"[^"]*"(,\\s*\\n\\s*trailerId: )"[^"]*"`);
  next = next.replace(block, `$1"${ids.videoId}"$2"${ids.trailerId}"`);
}
await writeFile(CATALOGUE, next);
console.log("\nSaved to lib/licences/catalogue.ts. Review the diff, then deploy.");
