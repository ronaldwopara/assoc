import { NextResponse } from "next/server";
import { storyById } from "@/lib/licences/catalogue";
import { bunnyConfigured, signedEmbedUrl } from "@/lib/licences/bunny";
import { sessionEmail } from "@/lib/licences/session";
import { activeLicenceFor } from "@/lib/licences/store";

export const dynamic = "force-dynamic";

/**
 * A short-lived signed Bunny embed URL for one story.
 *   ?story=<id>              the full film — needs a signed-in, running licence
 *   ?story=<id>&trailer=1    the trailer — open to everyone
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const story = storyById(url.searchParams.get("story") ?? "");
  if (!story) return NextResponse.json({ error: "Unknown story" }, { status: 404 });

  const trailer = url.searchParams.get("trailer") === "1";
  const videoId = trailer ? story.trailerId : story.videoId;
  if (!videoId) return NextResponse.json({ error: "not-ready", message: "This video isn't available yet." }, { status: 404 });
  if (!bunnyConfigured()) {
    return NextResponse.json({ error: "not-ready", message: "Video playback isn't set up yet." }, { status: 503 });
  }

  if (!trailer) {
    const email = await sessionEmail();
    if (!email) return NextResponse.json({ error: "sign-in" }, { status: 401 });
    const licence = await activeLicenceFor(email).catch(() => null);
    if (!licence) return NextResponse.json({ error: "no-licence" }, { status: 403 });
  }

  return NextResponse.json(
    { url: signedEmbedUrl(videoId) },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
