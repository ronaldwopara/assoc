import { NextResponse } from "next/server";
import { isUpgradeAuthenticated } from "@/lib/gallery-cms/auth";
import { getPopupCmsData, savePopupCmsData } from "@/lib/popup-cms";
import { normalizePopupCmsData } from "@/lib/popup-cms/helpers";
import { buildSeedPopupCms } from "@/lib/popup-cms/seed";

export async function GET() {
  if (!(await isUpgradeAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const data = await getPopupCmsData();
  return NextResponse.json(data);
}

export async function PUT(request: Request) {
  if (!(await isUpgradeAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const body = await request.json();
    const saved = await savePopupCmsData(
      normalizePopupCmsData(body, buildSeedPopupCms()),
    );
    return NextResponse.json(saved);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to save popup content";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
