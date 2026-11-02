import { NextResponse } from "next/server";
import { isUpgradeAuthenticated } from "@/lib/gallery-cms/auth";
import { composerEmail, isAutoEmailId, sampleAutoEmail, type ComposerContent, type EditableCopy } from "@/lib/emails";

/** Live preview of unsaved edits: { kind: "auto", id, copy } or { kind: "composer", content }. */
export async function POST(request: Request) {
  try {
    if (!(await isUpgradeAuthenticated())) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const body = (await request.json()) as { kind?: string; id?: unknown; copy?: Partial<EditableCopy>; content?: ComposerContent };
    if (body.kind === "auto" && isAutoEmailId(body.id)) {
      const email = sampleAutoEmail(body.id, { [body.id]: body.copy ?? {} });
      return NextResponse.json({ subject: email.subject, html: email.html });
    }
    if (body.kind === "composer" && body.content) {
      const email = composerEmail(body.content, { email: "ada@example.com", name: "Ada Okafor" }, "#unsubscribe");
      return NextResponse.json({ subject: email.subject, html: email.html });
    }
    return NextResponse.json({ error: "Nothing to preview" }, { status: 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Preview failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
