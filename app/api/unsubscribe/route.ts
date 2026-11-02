import { NextResponse } from "next/server";
import { setUnsubscribed, verifyUnsubscribeToken } from "@/lib/unsubscribe";

/**
 * POST — the unsubscribe page calls this as soon as it opens, and mail apps
 * call it for one-click unsubscribe (RFC 8058, List-Unsubscribe-Post).
 * { e, t, undo? } as JSON, or e/t in the query string.
 */
export async function POST(request: Request) {
  const url = new URL(request.url);
  let e = url.searchParams.get("e") ?? "";
  let t = url.searchParams.get("t") ?? "";
  let undo = false;
  if ((request.headers.get("content-type") ?? "").includes("application/json")) {
    const body = (await request.json().catch(() => ({}))) as { e?: string; t?: string; undo?: boolean };
    e = body.e ?? e;
    t = body.t ?? t;
    undo = Boolean(body.undo);
  }
  if (!e || !verifyUnsubscribeToken(e, t)) {
    return NextResponse.json({ error: "This unsubscribe link isn't valid." }, { status: 400 });
  }
  try {
    await setUnsubscribed(e, !undo);
    return NextResponse.json({ ok: true, unsubscribed: !undo });
  } catch (error) {
    console.error("[unsubscribe]", error);
    return NextResponse.json({ error: "Something went wrong. Reply to any ASOSC email and we'll remove you." }, { status: 500 });
  }
}
