import { NextResponse } from "next/server";
import { isUpgradeAuthenticated } from "@/lib/gallery-cms/auth";
import {
  getDocumentsCmsData,
  saveDocumentsCmsData,
} from "@/lib/documents-cms";
import { normalizeDocumentsCmsData } from "@/lib/documents-cms/helpers";
import { buildSeedDocumentsCms } from "@/lib/documents-cms/seed";

export async function GET() {
  if (!(await isUpgradeAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const data = await getDocumentsCmsData();
  return NextResponse.json(data);
}

export async function PUT(request: Request) {
  if (!(await isUpgradeAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const body = await request.json();
    const saved = await saveDocumentsCmsData(
      normalizeDocumentsCmsData(body, buildSeedDocumentsCms()),
    );
    return NextResponse.json(saved);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to save documents content";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
