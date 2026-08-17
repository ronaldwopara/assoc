import { NextResponse } from "next/server";
import { isUpgradeAuthenticated } from "@/lib/gallery-cms/auth";
import { isDashboardSheetSource, resolveDashboardSheetId } from "@/lib/dashboard-sheets";
import {
  appendSheetRow,
  ensurePaidColumn,
  ensureSheetTab,
  getAccessTokenForAccount,
  getSheetValues,
  updateSheetRow,
} from "@/lib/google-sheets";

/** Lists that carry a "PAID OR NOT" status — self-healed onto the sheet the first time it's opened. */
function needsPaidColumn(source: string, tab: string): boolean {
  if (source === "donor" && tab === "Donations") return true;
  if (source === "vendor" && tab === "Vendors") return true;
  if (source === "master" && tab === "Vendors") return true;
  if (source === "membership") return true;
  return false;
}

export async function GET(request: Request) {
  try {
    if (!(await isUpgradeAuthenticated())) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const url = new URL(request.url);
    const tab = url.searchParams.get("tab");
    if (!tab) {
      return NextResponse.json({ error: "Missing ?tab=" }, { status: 400 });
    }
    const sourceParam = url.searchParams.get("source") ?? "master";
    if (!isDashboardSheetSource(sourceParam)) {
      return NextResponse.json({ error: "Invalid source" }, { status: 400 });
    }

    const spreadsheetId = resolveDashboardSheetId(sourceParam);
    const { accessToken } = await getAccessTokenForAccount();

    if (needsPaidColumn(sourceParam, tab)) {
      if (sourceParam === "donor") await ensureSheetTab(accessToken, spreadsheetId, tab);
      await ensurePaidColumn(accessToken, spreadsheetId, tab);
    }

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

    const body = (await request.json()) as { tab?: string; values?: string[]; source?: string };

    if (!body.tab || !Array.isArray(body.values)) {
      return NextResponse.json({ error: "Missing or invalid tab or values" }, { status: 400 });
    }
    const source = body.source ?? "master";
    if (!isDashboardSheetSource(source)) {
      return NextResponse.json({ error: "Invalid source" }, { status: 400 });
    }

    const spreadsheetId = resolveDashboardSheetId(source);
    const { accessToken } = await getAccessTokenForAccount();

    if (source === "master" && body.tab === "Master List") {
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

    const body = (await request.json()) as {
      tab?: string;
      rowNumber?: number;
      values?: string[];
      source?: string;
    };

    if (!body.tab || !Number.isInteger(body.rowNumber) || body.rowNumber! < 2 || !Array.isArray(body.values)) {
      return NextResponse.json({ error: "Missing or invalid tab, rowNumber, or values" }, { status: 400 });
    }
    const source = body.source ?? "master";
    if (!isDashboardSheetSource(source)) {
      return NextResponse.json({ error: "Invalid source" }, { status: 400 });
    }

    const spreadsheetId = resolveDashboardSheetId(source);
    const { accessToken } = await getAccessTokenForAccount();
    await updateSheetRow(accessToken, spreadsheetId, body.tab, body.rowNumber!, body.values);

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update row";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
