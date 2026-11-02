import { NextResponse } from "next/server";
import { isUpgradeAuthenticated } from "@/lib/gallery-cms/auth";
import { MAX_BATCH, sendBatch, type Recipient } from "@/lib/compose";
import type { ComposerContent } from "@/lib/emails";

export const maxDuration = 60;

/** Send one batch: { content, recipients (≤10), test }. The dashboard loops batches and shows progress. */
export async function POST(request: Request) {
  try {
    if (!(await isUpgradeAuthenticated())) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const body = (await request.json()) as { content?: ComposerContent; recipients?: Recipient[]; test?: boolean };
    if (!body.content || !Array.isArray(body.recipients)) {
      return NextResponse.json({ error: "Missing content or recipients" }, { status: 400 });
    }
    if (body.recipients.length > MAX_BATCH) {
      return NextResponse.json({ error: `At most ${MAX_BATCH} recipients per request` }, { status: 400 });
    }
    const recipients = body.recipients.map((r) => ({ email: String(r?.email ?? ""), name: String(r?.name ?? "") }));
    const results = await sendBatch(body.content, recipients, { test: Boolean(body.test) });
    return NextResponse.json({ results });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Send failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
