import { NextResponse } from "next/server";
import { isUpgradeAuthenticated } from "@/lib/gallery-cms/auth";
import { MASTER_TABS, masterSheetId, type MasterTabName } from "@/lib/master-sheet";
import {
  appendSheetRow,
  getAccessTokenForAccount,
  getSheetValues,
  updateSheetRow,
} from "@/lib/google-sheets";

const ALLOWED_TABS = new Set<string>(Object.values(MASTER_TABS));

/** Only tabs defined in lib/master-sheet.ts can be read or written from the dashboard. */
function allowedTab(tab: unknown): tab is MasterTabName {
  return typeof tab === "string" && ALLOWED_TABS.has(tab);
}

export async function GET(request: Request) {
  try {
    if (!(await isUpgradeAuthenticated())) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const tab = new URL(request.url).searchParams.get("tab");
    if (!allowedTab(tab)) {
      return NextResponse.json({ error: "Unknown tab" }, { status: 400 });
    }

    const { accessToken } = await getAccessTokenForAccount();
    const values = await getSheetValues(accessToken, masterSheetId(), tab);

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
    if (!allowedTab(body.tab) || !Array.isArray(body.values)) {
      return NextResponse.json({ error: "Missing or invalid tab or values" }, { status: 400 });
    }

    const spreadsheetId = masterSheetId();
    const { accessToken } = await getAccessTokenForAccount();

    if (body.tab === MASTER_TABS.masterList) {
      const [headers = [], ...existingRows] = await getSheetValues(accessToken, spreadsheetId, body.tab);
      const emailCol = headers.findIndex((h) => h.trim().toLowerCase() === "email");
      const newEmail = emailCol !== -1 ? (body.values[emailCol] ?? "").trim().toLowerCase() : "";
      if (emailCol !== -1 && newEmail) {
        const isDuplicate = existingRows.some(
          (row) => (row[emailCol] ?? "").trim().toLowerCase() === newEmail,
        );
        if (isDuplicate) {
          return NextResponse.json(
            { error: "A row with this email already exists in Master List." },
            { status: 409 },
          );
        }
      }
    }

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

    const body = (await request.json()) as { tab?: string; rowNumber?: number; values?: string[] };
    if (
      !allowedTab(body.tab) ||
      !Number.isInteger(body.rowNumber) ||
      body.rowNumber! < 2 ||
      !Array.isArray(body.values)
    ) {
      return NextResponse.json({ error: "Missing or invalid tab, rowNumber, or values" }, { status: 400 });
    }

    const { accessToken } = await getAccessTokenForAccount();
    await updateSheetRow(accessToken, masterSheetId(), body.tab, body.rowNumber!, body.values);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update row";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
