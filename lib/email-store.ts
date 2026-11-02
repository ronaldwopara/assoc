/**
 * Saved email wording on the master sheet's "Email Templates" tab
 * (Key | JSON | Updated), created on first save.
 *   auto:<AutoEmailId>  → edited wording for an automatic email (CopyOverrides entry)
 *   draft:<slug>        → a saved composer template (ComposerContent + name)
 */

import { randomBytes } from "node:crypto";
import {
  appendSheetRow,
  ensureSheetTab,
  getAccessTokenForAccount,
  getSheetValues,
  updateSheetRow,
} from "@/lib/google-sheets";
import { masterSheetId } from "@/lib/master-sheet";
import { formatTimestamp } from "@/lib/sheet-dates";
import {
  isAutoEmailId,
  type AutoEmailId,
  type ComposerContent,
  type CopyOverrides,
  type EditableCopy,
} from "@/lib/emails";

const TAB = "Email Templates";
const HEADERS = ["Key", "JSON", "Updated"];

type Row = { key: string; json: string; updated: string; rowNumber: number };

async function readRows(): Promise<Row[]> {
  const { accessToken } = await getAccessTokenForAccount();
  try {
    const [, ...rows] = await getSheetValues(accessToken, masterSheetId(), TAB);
    return rows
      .map((r, i) => ({ key: String(r[0] ?? "").trim(), json: String(r[1] ?? ""), updated: String(r[2] ?? ""), rowNumber: i + 2 }))
      .filter((r) => r.key);
  } catch {
    return []; // tab not created yet
  }
}

async function writeRow(key: string, value: unknown | null): Promise<void> {
  const spreadsheetId = masterSheetId();
  const { accessToken } = await getAccessTokenForAccount();
  await ensureSheetTab(accessToken, spreadsheetId, TAB);
  const all = await getSheetValues(accessToken, spreadsheetId, TAB);
  if (all.length === 0) await updateSheetRow(accessToken, spreadsheetId, TAB, 1, HEADERS);
  const index = all.findIndex((r, i) => i > 0 && String(r[0] ?? "").trim() === key);
  // Deleting = blanking the row (keeps row numbers stable for anything else reading the tab).
  const values = value === null ? ["", "", ""] : [key, JSON.stringify(value), formatTimestamp(new Date())];
  if (index > 0) await updateSheetRow(accessToken, spreadsheetId, TAB, index + 1, values);
  else if (value !== null) await appendSheetRow(accessToken, spreadsheetId, TAB, values);
}

function parse<T>(json: string): T | null {
  try {
    return JSON.parse(json) as T;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------- automatic email wording

export async function getCopyOverrides(): Promise<CopyOverrides> {
  const out: CopyOverrides = {};
  for (const row of await readRows()) {
    if (!row.key.startsWith("auto:")) continue;
    const id = row.key.slice(5);
    const value = parse<Partial<EditableCopy>>(row.json);
    if (isAutoEmailId(id) && value) out[id] = value;
  }
  return out;
}

const COPY_FIELDS: Array<keyof EditableCopy> = ["subject", "preheader", "banner", "headline", "subhead", "intro", "outro", "heroUrl"];

export async function saveCopyOverride(id: AutoEmailId, copy: Partial<EditableCopy>): Promise<void> {
  const clean: Partial<EditableCopy> = {};
  for (const k of COPY_FIELDS) {
    const v = copy[k];
    if (typeof v === "string") clean[k] = v.slice(0, 10000);
  }
  await writeRow(`auto:${id}`, clean);
}

export async function resetCopyOverride(id: AutoEmailId): Promise<void> {
  await writeRow(`auto:${id}`, null);
}

// ---------------------------------------------------------------- composer templates

export type SavedTemplate = { id: string; name: string; updated: string; content: ComposerContent };

export async function listTemplates(): Promise<SavedTemplate[]> {
  const out: SavedTemplate[] = [];
  for (const row of await readRows()) {
    if (!row.key.startsWith("draft:")) continue;
    const value = parse<{ name: string; content: ComposerContent }>(row.json);
    if (value?.content) out.push({ id: row.key.slice(6), name: value.name || "Untitled", updated: row.updated, content: value.content });
  }
  return out.sort((a, b) => b.updated.localeCompare(a.updated));
}

export async function saveTemplate(name: string, content: ComposerContent, id?: string): Promise<string> {
  const templateId = id && /^[a-z0-9-]{4,40}$/.test(id) ? id : randomBytes(6).toString("hex");
  await writeRow(`draft:${templateId}`, { name: name.trim().slice(0, 120) || "Untitled", content });
  return templateId;
}

export async function deleteTemplate(id: string): Promise<void> {
  if (!/^[a-z0-9-]{4,40}$/.test(id)) throw new Error("Invalid template id");
  await writeRow(`draft:${id}`, null);
}
