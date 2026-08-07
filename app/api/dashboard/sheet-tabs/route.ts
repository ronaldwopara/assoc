import { NextResponse } from "next/server";
import { isUpgradeAuthenticated } from "@/lib/gallery-cms/auth";
import { getAccessTokenForAccount, getSpreadsheetTabs } from "@/lib/google-sheets";

function masterSheetId() {
  const id = process.env.GOOGLE_MASTER_SHEET_ID?.trim();
  if (!id) throw new Error("GOOGLE_MASTER_SHEET_ID is not configured");
  return id;
}

export async function GET() {
  try {
    if (!(await isUpgradeAuthenticated())) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const spreadsheetId = masterSheetId();
    const { accessToken } = await getAccessTokenForAccount();
    const { title, tabs } = await getSpreadsheetTabs(accessToken, spreadsheetId);

    return NextResponse.json({ spreadsheetId, spreadsheetTitle: title, tabs });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to read spreadsheet tabs";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
