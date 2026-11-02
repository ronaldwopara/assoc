import { NextResponse } from "next/server";
import { isUpgradeAuthenticated } from "@/lib/gallery-cms/auth";
import { isRecipientListId, resolveRecipients, type MemberFilter } from "@/lib/compose";

/** Who an email would go to: { lists, memberFilter, extra }. */
export async function POST(request: Request) {
  try {
    if (!(await isUpgradeAuthenticated())) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const body = (await request.json()) as { lists?: unknown[]; memberFilter?: string; extra?: string };
    const lists = (body.lists ?? []).filter(isRecipientListId);
    const memberFilter: MemberFilter = body.memberFilter === "paid" || body.memberFilter === "unpaid" ? body.memberFilter : "all";
    const result = await resolveRecipients({ lists, memberFilter, extra: String(body.extra ?? "").slice(0, 20000) });
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Couldn't load recipients";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
