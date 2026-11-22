import { NextResponse } from "next/server";
import { isUpgradeAuthenticated } from "@/lib/gallery-cms/auth";
import { listBunnyVideos, startBunnyUpload } from "@/lib/licences/bunny";

export const dynamic = "force-dynamic";

/** The videos in the Bunny library, newest first, for the film and trailer pickers. */
export async function GET() {
  if (!(await isUpgradeAuthenticated())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    return NextResponse.json({ videos: await listBunnyVideos() });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Couldn't load videos" }, { status: 500 });
  }
}

/** Starts an upload: { title } → credentials for the browser to send the file straight to Bunny. */
export async function POST(request: Request) {
  if (!(await isUpgradeAuthenticated())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const { title } = (await request.json()) as { title?: string };
    return NextResponse.json(await startBunnyUpload(String(title ?? "")));
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Couldn't start the upload" }, { status: 500 });
  }
}
