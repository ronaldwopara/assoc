import { NextResponse } from "next/server";
import { isUpgradeAuthenticated } from "@/lib/gallery-cms/auth";
import { getDocumentaries, saveDocumentaries } from "@/lib/documentaries";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await isUpgradeAuthenticated())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json(await getDocumentaries(true));
}

export async function PUT(request: Request) {
  if (!(await isUpgradeAuthenticated())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const body = (await request.json()) as { items?: unknown };
    return NextResponse.json(await saveDocumentaries(body.items));
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Save failed" }, { status: 500 });
  }
}
