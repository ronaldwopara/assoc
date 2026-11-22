import { NextResponse } from "next/server";
import { isUpgradeAuthenticated } from "@/lib/gallery-cms/auth";
import { MASTER_TABS, masterSheetId } from "@/lib/master-sheet";
import { columnLetter, getAccessTokenForAccount, invalidateReadCache } from "@/lib/google-sheets";
import { rowHasContent } from "@/lib/sheet-rows";

export const dynamic = "force-dynamic";

/** The tabs that hold people. */
const TABS = [
  MASTER_TABS.masterList,
  MASTER_TABS.volunteers,
  MASTER_TABS.vendors,
  MASTER_TABS.newsletter,
  MASTER_TABS.contact,
  MASTER_TABS.donations,
  MASTER_TABS.registrations,
];

/**
 * Clears rows that hold nothing but tick-box values (TRUE/FALSE) and no
 * person, so new sign-ups land right under the real rows. Only those values
 * are cleared; rows with anything else in them are never touched. The tick
 * boxes themselves (data validation) stay.
 *   POST { dryRun?: boolean } → { tabs: [{ tab, realRows, cleared }] }
 */
export async function POST(request: Request) {
  if (!(await isUpgradeAuthenticated())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { dryRun = true } = (await request.json().catch(() => ({}))) as { dryRun?: boolean };
  try {
    const id = masterSheetId();
    const { accessToken } = await getAccessTokenForAccount();
    const auth = { Authorization: `Bearer ${accessToken}` };
    const out: { tab: string; realRows: number; cleared: number }[] = [];

    for (const tab of TABS) {
      const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${id}/values/${encodeURIComponent(tab)}`, {
        headers: auth,
        cache: "no-store",
      });
      if (res.status === 400) continue; // tab doesn't exist
      if (!res.ok) throw new Error(`Couldn't read ${tab} (${res.status})`);
      const { values = [] } = (await res.json()) as { values?: string[][] };
      const [headers = [], ...rows] = values;
      const width = Math.max(headers.length, ...rows.map((r) => r.length), 1);

      // Contiguous runs of tick-box-only rows, as sheet row numbers (header is row 1).
      const runs: [number, number][] = [];
      let cleared = 0;
      rows.forEach((row, i) => {
        if (rowHasContent(row) || row.every((c) => !String(c ?? "").trim())) return;
        cleared++;
        const n = i + 2;
        const last = runs[runs.length - 1];
        if (last && last[1] === n - 1) last[1] = n;
        else runs.push([n, n]);
      });
      out.push({ tab, realRows: rows.filter(rowHasContent).length, cleared });

      if (!dryRun && runs.length) {
        const ranges = runs.map(([a, b]) => `'${tab.replace(/'/g, "''")}'!A${a}:${columnLetter(width)}${b}`);
        const clear = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${id}/values:batchClear`, {
          method: "POST",
          headers: { ...auth, "Content-Type": "application/json" },
          body: JSON.stringify({ ranges }),
        });
        if (!clear.ok) throw new Error(`Couldn't tidy ${tab} (${clear.status})`);
        invalidateReadCache(id, tab);
      }
    }
    return NextResponse.json({ dryRun, tabs: out });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Tidy failed" }, { status: 500 });
  }
}
