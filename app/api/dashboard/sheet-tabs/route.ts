import { NextResponse } from "next/server";
import { isUpgradeAuthenticated } from "@/lib/gallery-cms/auth";
import { isDashboardSheetSource, resolveDashboardSheetId } from "@/lib/dashboard-sheets";
import { getAccessTokenForAccount, getSpreadsheetTabs } from "@/lib/google-sheets";

export async function GET(request: Request) {
  try {
    if (!(await isUpgradeAuthenticated())) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const sourceParam = new URL(request.url).searchParams.get("source") ?? "master";
    if (!isDashboardSheetSource(sourceParam)) {
      return NextResponse.json({ error: "Invalid source" }, { status: 400 });
    }

    const spreadsheetId = resolveDashboardSheetId(sourceParam);
    const { accessToken } = await getAccessTokenForAccount();
    const { title, tabs } = await getSpreadsheetTabs(accessToken, spreadsheetId);

    return NextResponse.json({ spreadsheetId, spreadsheetTitle: title, tabs });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to read spreadsheet tabs";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
