import { NextResponse } from "next/server";
import { isUpgradeAuthenticated } from "@/lib/gallery-cms/auth";
import { listInteracMatchCandidates } from "@/lib/interac-payments";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    if (!(await isUpgradeAuthenticated())) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const candidates = await listInteracMatchCandidates();
    return NextResponse.json({ ok: true, candidates });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load match options";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
