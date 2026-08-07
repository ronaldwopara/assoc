import { NextResponse } from "next/server";
import { isUpgradeAuthenticated } from "@/lib/gallery-cms/auth";
import { appendSheetRow, getAccessTokenForAccount, getSheetValues, updateSheetRow } from "@/lib/google-sheets";

function masterSheetId() {
  const id = process.env.GOOGLE_MASTER_SHEET_ID?.trim();
  if (!id) throw new Error("GOOGLE_MASTER_SHEET_ID is not configured");
  return id;
}

export async function GET(request: Request) {
  try {
    if (!(await isUpgradeAuthenticated())) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const tab = new URL(request.url).searchParams.get("tab");
    if (!tab) {
      return NextResponse.json({ error: "Missing ?tab=" }, { status: 400 });
    }

    const spreadsheetId = masterSheetId();
    const { accessToken } = await getAccessTokenForAccount();
    const values = await getSheetValues(accessToken, spreadsheetId, tab);

    const [headers = [], ...rows] = values;
    return NextResponse.json({ headers, rows });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to read sheet rows";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    if (!(await isUpgradeAuthenticated())) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await request.json()) as { tab?: string; values?: string[] };

    if (!body.tab || !Array.isArray(body.values)) {
      return NextResponse.json({ error: "Missing or invalid tab or values" }, { status: 400 });
    }

    const spreadsheetId = masterSheetId();
    const { accessToken } = await getAccessTokenForAccount();
    const rowNumber = await appendSheetRow(accessToken, spreadsheetId, body.tab, body.values);

    return NextResponse.json({ ok: true, rowNumber });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to add row";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    if (!(await isUpgradeAuthenticated())) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await request.json()) as {
      tab?: string;
      rowNumber?: number;
      values?: string[];
    };

    if (!body.tab || !Number.isInteger(body.rowNumber) || body.rowNumber! < 2 || !Array.isArray(body.values)) {
      return NextResponse.json({ error: "Missing or invalid tab, rowNumber, or values" }, { status: 400 });
    }

    const spreadsheetId = masterSheetId();
    const { accessToken } = await getAccessTokenForAccount();
    await updateSheetRow(accessToken, spreadsheetId, body.tab, body.rowNumber!, body.values);

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update row";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
