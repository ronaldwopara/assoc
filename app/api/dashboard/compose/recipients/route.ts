import { NextResponse } from "next/server";
import { isUpgradeAuthenticated } from "@/lib/gallery-cms/auth";
import { audienceOptions, isRecipientListId, resolveRecipients, type MemberFilter } from "@/lib/compose";

const strings = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string").map((x) => x.slice(0, 200)).slice(0, 100) : []);

/** The "From" choices: which forms volunteers came through, and which events people registered for. */
export async function GET() {
  try {
    if (!(await isUpgradeAuthenticated())) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json(await audienceOptions());
  } catch (error) {
    const message = error instanceof Error ? error.message : "Couldn't load the lists";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/** Who an email would go to: { lists, memberFilter, volunteerFrom, events, extra }. */
export async function POST(request: Request) {
  try {
    if (!(await isUpgradeAuthenticated())) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const body = (await request.json()) as { lists?: unknown[]; memberFilter?: string; volunteerFrom?: unknown; events?: unknown; extra?: string };
    const lists = (body.lists ?? []).filter(isRecipientListId);
    const memberFilter: MemberFilter = body.memberFilter === "paid" || body.memberFilter === "unpaid" ? body.memberFilter : "all";
    const result = await resolveRecipients({
      lists,
      memberFilter,
      volunteerFrom: strings(body.volunteerFrom),
      events: strings(body.events),
      extra: String(body.extra ?? "").slice(0, 20000),
    });
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Couldn't load recipients";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
