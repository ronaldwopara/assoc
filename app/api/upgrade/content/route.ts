import { NextResponse } from "next/server";
import { isUpgradeAuthenticated } from "@/lib/gallery-cms/auth";
import { getGalleryCmsData, saveGalleryCmsData } from "@/lib/gallery-cms";
import { normalizeGalleryCmsData } from "@/lib/gallery-cms/helpers";
import { buildSeedGalleryCms } from "@/lib/gallery-cms/seed";

export async function GET() {
  if (!(await isUpgradeAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const data = await getGalleryCmsData();
  return NextResponse.json(data);
}

export async function PUT(request: Request) {
  if (!(await isUpgradeAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const body = await request.json();
    const saved = await saveGalleryCmsData(
      normalizeGalleryCmsData(body, buildSeedGalleryCms()),
    );
    return NextResponse.json(saved);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to save gallery content";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
