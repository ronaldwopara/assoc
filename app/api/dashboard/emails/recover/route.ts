import { NextResponse } from "next/server";
import { isUpgradeAuthenticated } from "@/lib/gallery-cms/auth";
import { getAccessTokenForAccount, getSpreadsheetTabs } from "@/lib/google-sheets";
import { masterSheetId } from "@/lib/master-sheet";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Temporary: reads the "Email Templates" tab from recent versions of the master sheet. */
export async function GET() {
  if (!(await isUpgradeAuthenticated())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const id = masterSheetId();
    const { accessToken } = await getAccessTokenForAccount();
    const auth = { Authorization: `Bearer ${accessToken}` };
    const { tabs } = await getSpreadsheetTabs(accessToken, id);
    const gid = tabs.find((t) => t.title === "Email Templates")?.sheetId;
    const list = await fetch(`https://www.googleapis.com/drive/v3/files/${id}/revisions?fields=revisions(id,modifiedTime)&pageSize=200`, { headers: auth });
    const body = (await list.json()) as { revisions?: { id: string; modifiedTime: string }[]; error?: { message?: string } };
    if (!list.ok) return NextResponse.json({ step: "list", status: list.status, error: body.error?.message }, { status: 500 });
    const revs = (body.revisions ?? []).slice(-12).reverse();
    const out: { id: string; time: string; csv?: string; status?: number }[] = [];
    for (const r of revs) {
      const res = await fetch(`https://docs.google.com/spreadsheets/export?id=${id}&revision=${r.id}&exportFormat=csv&gid=${gid}`, { headers: auth });
      out.push({ id: r.id, time: r.modifiedTime, status: res.status, csv: res.ok ? (await res.text()).slice(0, 20000) : undefined });
    }
    return NextResponse.json({ gid, revisions: out });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "failed" }, { status: 500 });
  }
}
