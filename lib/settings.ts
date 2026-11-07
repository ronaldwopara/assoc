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
  /** Days after first contact (sign-up, or a vendor's approval) to send each reminder. Then they stop. */
  days: number[];
};

/** 1, 3 and 7 days after first contact, then stop. */
export const DEFAULT_SCHEDULE: ReminderSchedule = { days: [1, 3, 7] };

const SCHEDULE_KEY = "Reminder schedule";

/** Whole days 1–365, no repeats, in order, at most 10. Older saved settings (every-N-days) fall back to the default. */
export function cleanSchedule(input: { days?: unknown }): ReminderSchedule {
  const raw = Array.isArray(input.days) ? input.days : typeof input.days === "string" ? input.days.split(/[^\d]+/) : [];
  const days = [...new Set(raw.map((d) => Math.round(Number(d))).filter((d) => Number.isFinite(d) && d >= 1 && d <= 365))]
    .sort((a, b) => a - b)
    .slice(0, 10);
  return days.length ? { days } : { days: [...DEFAULT_SCHEDULE.days] };
}

export async function getReminderSchedule(): Promise<ReminderSchedule> {
  try {
    return cleanSchedule(JSON.parse((await getSetting(SCHEDULE_KEY)) || "{}"));
  } catch {
    return { days: [...DEFAULT_SCHEDULE.days] };
  }
}

export async function setReminderSchedule(schedule: { days?: unknown }): Promise<ReminderSchedule> {
  const clean = cleanSchedule(schedule);
  await setSetting(SCHEDULE_KEY, JSON.stringify(clean));
  return clean;
}
