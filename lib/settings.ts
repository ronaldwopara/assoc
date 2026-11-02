/**
 * Staff-controlled switches, stored as Setting | Value rows on the master
 * sheet's "Settings" tab (created on first write) so the dashboard can change
 * them without a redeploy.
 */

import {
  appendSheetRow,
  ensureSheetTab,
  getAccessTokenForAccount,
  getSheetValues,
  updateSheetCell,
  updateSheetRow,
} from "@/lib/google-sheets";
import { masterSheetId } from "@/lib/master-sheet";

const SETTINGS_TAB = "Settings";

export const SETTING_KEYS = {
  autoSendEmails: "Automatic emails",
} as const;

async function readSettings(): Promise<string[][]> {
  const { accessToken } = await getAccessTokenForAccount();
  try {
    return await getSheetValues(accessToken, masterSheetId(), SETTINGS_TAB);
  } catch {
    return []; // tab not created yet → every setting is at its default
  }
}

export async function getSetting(key: string): Promise<string> {
  const rows = await readSettings();
  return String(rows.find((r) => String(r[0] ?? "").trim() === key)?.[1] ?? "").trim();
}

export async function setSetting(key: string, value: string): Promise<void> {
  const spreadsheetId = masterSheetId();
  const { accessToken } = await getAccessTokenForAccount();
  await ensureSheetTab(accessToken, spreadsheetId, SETTINGS_TAB);
  const rows = await getSheetValues(accessToken, spreadsheetId, SETTINGS_TAB);
  if (rows.length === 0) await updateSheetRow(accessToken, spreadsheetId, SETTINGS_TAB, 1, ["Setting", "Value"]);
  const index = rows.findIndex((r) => String(r[0] ?? "").trim() === key);
  if (index >= 1) await updateSheetCell(accessToken, spreadsheetId, SETTINGS_TAB, index + 1, 2, value);
  else await appendSheetRow(accessToken, spreadsheetId, SETTINGS_TAB, [key, value]);
}

/** Off unless staff turned it on in the dashboard's Emails panel. */
export async function autoSendEnabled(): Promise<boolean> {
  return /^on$/i.test(await getSetting(SETTING_KEYS.autoSendEmails));
}

export async function setAutoSend(on: boolean): Promise<void> {
  await setSetting(SETTING_KEYS.autoSendEmails, on ? "On" : "Off");
}

// ---------------------------------------------------------------- reminder schedule

export type ReminderSchedule = {
  /** Days between reminders within a round (also: days after signup before the first). */
  daysBetween: number;
  /** Reminders per round. */
  perRound: number;
  /** Days to pause after a round before starting the next. */
  pauseDays: number;
  /** Rounds before reminders stop for good. */
  rounds: number;
};

export const DEFAULT_SCHEDULE: ReminderSchedule = { daysBetween: 7, perRound: 3, pauseDays: 30, rounds: 3 };

const SCHEDULE_KEY = "Reminder schedule";
const LIMITS: Record<keyof ReminderSchedule, [number, number]> = {
  daysBetween: [1, 60],
  perRound: [1, 10],
  pauseDays: [1, 365],
  rounds: [1, 12],
};

export function cleanSchedule(input: Partial<Record<keyof ReminderSchedule, unknown>>): ReminderSchedule {
  const out = { ...DEFAULT_SCHEDULE };
  for (const k of Object.keys(LIMITS) as Array<keyof ReminderSchedule>) {
    const n = Math.round(Number(input[k]));
    if (Number.isFinite(n)) out[k] = Math.min(LIMITS[k][1], Math.max(LIMITS[k][0], n));
  }
  return out;
}

export async function getReminderSchedule(): Promise<ReminderSchedule> {
  try {
    return cleanSchedule(JSON.parse((await getSetting(SCHEDULE_KEY)) || "{}"));
  } catch {
    return { ...DEFAULT_SCHEDULE };
  }
}

export async function setReminderSchedule(schedule: Partial<ReminderSchedule>): Promise<ReminderSchedule> {
  const clean = cleanSchedule(schedule);
  await setSetting(SCHEDULE_KEY, JSON.stringify(clean));
  return clean;
}
