/**
 * One-time copy of Interac Log rows from the donor spreadsheet onto INTERAC_LOG_SHEET_ID.
 *
 *   npx tsx --env-file=.env --env-file=.env.local scripts/copy-interac-log.ts
 */
import {
  ensureSheetTab,
  getAccessTokenForAccount,
  getSheetValues,
  getSpreadsheetTabs,
  updateSheetRange,
} from "@/lib/google-sheets";

const LOG_TAB = "Interac Log";
const FROM_ID = process.env.DONOR_SHEET_ID?.trim() ?? "";
const TO_ID = process.env.INTERAC_LOG_SHEET_ID?.trim() ?? "";

function headerIndex(headers: string[], name: string): number {
  const needle = name.trim().toLowerCase();
  return headers.findIndex((h) => h.trim().toLowerCase() === needle);
}

function rowId(headers: string[], row: string[]): string {
  const col = headerIndex(headers, "gmail message id");
  if (col < 0) return "";
  return String(row[col] ?? "").trim();
}

function padRow(row: string[], width: number): string[] {
  const next = row.map((cell) => String(cell ?? ""));
  while (next.length < width) next.push("");
  return next.slice(0, width);
}

async function clearTab(accessToken: string, spreadsheetId: string, tab: string) {
  const range = encodeURIComponent(tab);
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}:clear`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: "{}",
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw new Error(payload?.error?.message || `Failed to clear ${tab} (${response.status})`);
  }
}

async function pickSourceTab(accessToken: string, spreadsheetId: string): Promise<string> {
  const { tabs } = await getSpreadsheetTabs(accessToken, spreadsheetId);
  const exact = tabs.find((t) => t.title === LOG_TAB);
  if (exact) return exact.title;
  const fuzzy = tabs.find((t) => /interac/i.test(t.title));
  if (fuzzy) return fuzzy.title;
  if (tabs[0]) return tabs[0].title;
  throw new Error("Source spreadsheet has no tabs.");
}

async function main() {
  if (!FROM_ID) throw new Error("DONOR_SHEET_ID is not set");
  if (!TO_ID) throw new Error("INTERAC_LOG_SHEET_ID is not set");
  if (FROM_ID === TO_ID) throw new Error("Source and destination spreadsheet ids are the same");

  const { email, accessToken } = await getAccessTokenForAccount();
  console.log(`Signed in as ${email}`);

  const sourceTab = await pickSourceTab(accessToken, FROM_ID);
  const sourceValues = await getSheetValues(accessToken, FROM_ID, sourceTab);
  if (sourceValues.length === 0) {
    throw new Error(`Source tab "${sourceTab}" is empty`);
  }

  const sourceHeaders = sourceValues[0].map((h) => String(h ?? ""));
  const sourceRows = sourceValues.slice(1);
  console.log(`Source: ${FROM_ID} / "${sourceTab}" — ${sourceRows.length} data row(s)`);

  await ensureSheetTab(accessToken, TO_ID, LOG_TAB);
  const destValues = await getSheetValues(accessToken, TO_ID, LOG_TAB);
  const destHeaders = (destValues[0] ?? sourceHeaders).map((h) => String(h ?? ""));
  const destRows = destValues.slice(1);
  console.log(`Dest:   ${TO_ID} / "${LOG_TAB}" — ${destRows.length} data row(s)`);

  const headers = destHeaders.some((h) => h.trim()) ? destHeaders : sourceHeaders;
  const width = Math.max(headers.length, sourceHeaders.length);
  const alignedHeaders = padRow(headers, width);

  const byId = new Map<string, string[]>();
  const extras: string[][] = [];

  for (const row of destRows) {
    const padded = padRow(row, width);
    const id = rowId(alignedHeaders, padded);
    if (id) byId.set(id, padded);
    else extras.push(padded);
  }
  let added = 0;
  for (const row of sourceRows) {
    const padded = padRow(row, width);
    const id = rowId(sourceHeaders, padRow(row, sourceHeaders.length));
    if (id) {
      if (!byId.has(id)) {
        byId.set(id, padded);
        added += 1;
      }
    } else {
      extras.push(padded);
      added += 1;
    }
  }

  const merged = [alignedHeaders, ...[...byId.values()], ...extras];
  await clearTab(accessToken, TO_ID, LOG_TAB);
  await updateSheetRange(accessToken, TO_ID, LOG_TAB, "A1", merged);

  console.log(
    `Wrote ${merged.length - 1} data row(s) to the new Interac Log (${added} transferred from the old sheet).`,
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
