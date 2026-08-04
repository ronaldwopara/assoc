import { NextResponse } from "next/server";
import { isUpgradeAuthenticated } from "@/lib/gallery-cms/auth";
import { getGoogleConnectionStatus } from "@/lib/google-oauth";

export async function GET() {
  try {
    if (!(await isUpgradeAuthenticated())) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const status = await getGoogleConnectionStatus();
    return NextResponse.json(status);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to read Google connection status";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
