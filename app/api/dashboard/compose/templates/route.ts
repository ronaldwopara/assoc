import { NextResponse } from "next/server";
import { isUpgradeAuthenticated } from "@/lib/gallery-cms/auth";
import { deleteTemplate, listTemplates, saveTemplate } from "@/lib/email-store";
import type { ComposerContent } from "@/lib/emails";

async function guard() {
  return (await isUpgradeAuthenticated()) ? null : NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

export async function GET() {
  const denied = await guard();
  if (denied) return denied;
  try {
    return NextResponse.json({ templates: await listTemplates() });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed" }, { status: 500 });
  }
}

/** Save a composer template: { id?, name, content }. */
export async function PUT(request: Request) {
  const denied = await guard();
  if (denied) return denied;
  try {
    const body = (await request.json()) as { id?: string; name?: string; content?: ComposerContent };
    if (!body.content) return NextResponse.json({ error: "Missing content" }, { status: 400 });
    const id = await saveTemplate(String(body.name ?? ""), body.content, body.id);
    return NextResponse.json({ ok: true, id });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to save" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const denied = await guard();
  if (denied) return denied;
  try {
    await deleteTemplate(new URL(request.url).searchParams.get("id") ?? "");
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to delete" }, { status: 500 });
  }
}
