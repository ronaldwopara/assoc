import { NextResponse } from "next/server";
import { isUpgradeAuthenticated } from "@/lib/gallery-cms/auth";
import { DEFAULT_MONTHS_BACK, getOverview } from "@/lib/dashboard-overview";

export const maxDuration = 60;

export async function GET(request: Request) {
  try {
    if (!(await isUpgradeAuthenticated())) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const monthsParam = Number(new URL(request.url).searchParams.get("months"));
    const months = Number.isFinite(monthsParam) && monthsParam > 0 ? monthsParam : DEFAULT_MONTHS_BACK;
    const data = await getOverview(months);
    return NextResponse.json({ ok: true, ...data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load overview";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
