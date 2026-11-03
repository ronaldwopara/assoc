/**
 * Event Google Forms (festival volunteers, event registrations…) keep saving to
 * their own response sheets. This copies new responses into the master sheet
 * once a day (and on demand from the dashboard), through the same path as the
 * website forms: Master List + Volunteers or Event Registrations, duplicate
 * handling, and the confirmation email.
 *
 * The list of forms lives in the master sheet's Settings tab. Each form
 * remembers how many response rows it has already copied, so nobody is copied
 * or emailed twice, and a newly added form starts from "now" (old responses
 * aren't emailed).
 */

import { randomBytes } from "node:crypto";
import { getAccessTokenForAccount, getSheetValues } from "@/lib/google-sheets";
import { recordSubmission } from "@/lib/form-submissions";
import { getSetting, setSetting } from "@/lib/settings";

const KEY = "eventForms";
/** Per form per run, so a run fits in the 60s function limit. The rest follow next run. */
const MAX_PER_RUN = 15;

export type EventFormKind = "volunteer" | "event";

export type EventForm = {
  id: string;
  /** Shown in the dashboard, and used as the event name / volunteer interest. */
  name: string;
  kind: EventFormKind;
  sheetId: string;
  tab: string;
  /** Response rows already copied (null = not started; the first run starts from the current count). */
  copied: number | null;
  lastRun?: string;
  lastError?: string;
};

/** The event forms' response sheets (found via the "Spreadsheet shared with you" emails to support@asosc.ca). */
const STARTING_FORMS: EventForm[] = [
  { id: "af-volunteer", name: "African Festival", kind: "volunteer", sheetId: "1JiRx_K1OCJTRjukfzvy4pjj9sxILAcZlGBg16x-ideA", tab: "Form Responses 1", copied: null },
  { id: "bhm-volunteer", name: "Black History Month", kind: "volunteer", sheetId: "1J2QZM6zRZZsMSALX2Mpxp36xM7kdJWLpm4_pkK_wibA", tab: "Form Responses 1", copied: null },
  { id: "youth-volunteer", name: "African Youth Program", kind: "volunteer", sheetId: "1Un7UZRxanr3IvDLL6HTQrBQ9KHUYZgvtL8776Ve2uyg", tab: "Form Responses 1", copied: null },
  { id: "family-wellness", name: "Family Wellness Program", kind: "event", sheetId: "171qGf12ylriSVUGkrn3QD0vNrCbxxBS2jXMKc4ax0GY", tab: "Form Responses 1", copied: null },
  { id: "autism-support", name: "Autism & Special Needs Support", kind: "event", sheetId: "1s8lK8TJ3_9RiHJc4JN2JWR2CkH9h4LXgZCHLorQwpmY", tab: "Form Responses 1", copied: null },
  { id: "bhm-guests", name: "Black History Month", kind: "event", sheetId: "1W9d3aANZI43Xr0QfrFCza-Sej-p6m_sXUTij-Cw0OqE", tab: "Form Responses 1", copied: null },
  { id: "youth-council", name: "Youth Council (Voices of Heritage)", kind: "event", sheetId: "1Yc_lMmCjguZ0QiVn3aHwR0JHIA2ZnZGD5MIbISpd0pU", tab: "Form Responses 1", copied: null },
  { id: "womens-health", name: "Women's Health Webinar", kind: "event", sheetId: "1lonzesxwFA45CCdJ6xvuMrdN3mU2FFyNycUSSuwAJ64", tab: "ASOSC Women’s Health Webinar (Responses)", copied: null },
];

export async function listEventForms(): Promise<EventForm[]> {
  try {
    const raw = await getSetting(KEY);
    if (!raw) return STARTING_FORMS;
    const parsed = JSON.parse(raw) as EventForm[];
    return Array.isArray(parsed) ? parsed : STARTING_FORMS;
  } catch {
    return STARTING_FORMS;
  }
}

async function saveForms(forms: EventForm[]) {
  await setSetting(KEY, JSON.stringify(forms));
}

/** Pulls the spreadsheet id out of a pasted link (or accepts a bare id). */
export function sheetIdFromLink(link: string): string | null {
  const m = link.match(/\/spreadsheets\/d\/([A-Za-z0-9_-]{20,})/) ?? link.trim().match(/^([A-Za-z0-9_-]{20,})$/);
  return m ? m[1] : null;
}

/** Adds a form after checking the site can read its response sheet. */
export async function addEventForm(input: { name: string; kind: EventFormKind; link: string; tab?: string }): Promise<EventForm> {
  const sheetId = sheetIdFromLink(input.link);
  if (!sheetId) throw new Error("Paste the link to the form's response spreadsheet (it starts with docs.google.com/spreadsheets).");
  const name = input.name.trim().slice(0, 120);
  if (!name) throw new Error("Give the form a name, like the event it's for.");
  const { accessToken } = await getAccessTokenForAccount();
  const meta = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}?fields=sheets.properties.title`,
    { headers: { Authorization: `Bearer ${accessToken}` }, cache: "no-store" },
  );
  if (!meta.ok) {
    throw new Error("The website can't open that spreadsheet. Share it with africanssocietyofsc@gmail.com (Viewer is enough) and try again.");
  }
  const tabs = ((await meta.json()) as { sheets?: Array<{ properties: { title: string } }> }).sheets?.map((s) => s.properties.title) ?? [];
  const tab = input.tab?.trim() || tabs.find((t) => /form responses/i.test(t)) || tabs[0];
  if (!tab || !tabs.includes(tab)) throw new Error(`That spreadsheet has no tab called "${input.tab}".`);
  const form: EventForm = { id: randomBytes(4).toString("hex"), name, kind: input.kind === "event" ? "event" : "volunteer", sheetId, tab, copied: null };
  await saveForms([...(await listEventForms()), form]);
  return form;
}

export async function removeEventForm(id: string): Promise<void> {
  await saveForms((await listEventForms()).filter((f) => f.id !== id));
}

// ---------------------------------------------------------------- reading a response

const norm = (h: string) => h.replace(/\s+/g, " ").trim();

/** Finds name / email / phone in a Google Form response, whatever the questions are called. */
export function readResponse(headers: string[], row: string[]) {
  const cells = headers.map((h, i) => ({ q: norm(h), a: String(row[i] ?? "").trim() }));
  // Questions about someone else (emergency contact, spouse, child…) never count as theirs.
  const SOMEONE_ELSE = /spouse|emergency|child|parent|guardian|partner|kid/i;
  const find = (re: RegExp) => cells.findIndex((c) => re.test(c.q) && !SOMEONE_ELSE.test(c.q));
  const used = new Set<number>([0]); // column A is the form's timestamp
  const take = (i: number) => {
    if (i < 0) return "";
    used.add(i);
    return cells[i].a;
  };

  let name = take(find(/^(your\s+)?(full\s*)?name\b/i));
  if (!name) {
    name = [take(find(/first\s*name|name:\s*first/i)), take(find(/last\s*name|surname|name:\s*last/i))].filter(Boolean).join(" ");
  }
  const email = take(find(/e-?mail/i));
  const phone = take(find(/phone/i));
  const details = cells
    .filter((c, i) => !used.has(i) && c.a && c.q)
    .map((c) => `${c.q}: ${c.a}`)
    .join("\n");
  return { name, email: email.toLowerCase(), phone, details };
}

// ---------------------------------------------------------------- copying

export type EventFormRunResult = { copied: number; skipped: number; errors: string[]; forms: Array<{ name: string; copied: number; waiting: number; error?: string }> };

export async function syncEventForms(): Promise<EventFormRunResult> {
  const forms = await listEventForms();
  const { accessToken } = await getAccessTokenForAccount();
  const result: EventFormRunResult = { copied: 0, skipped: 0, errors: [], forms: [] };

  for (const form of forms) {
    const summary = { name: form.name, copied: 0, waiting: 0 } as EventFormRunResult["forms"][number];
    try {
      const [headers = [], ...rows] = await getSheetValues(accessToken, form.sheetId, form.tab);
      // First run: start from now, so people who signed up months ago aren't emailed.
      if (form.copied === null) form.copied = rows.length;
      // Rows deleted from the response sheet: don't go backwards.
      if (form.copied > rows.length) form.copied = rows.length;

      const end = Math.min(rows.length, form.copied + MAX_PER_RUN);
      for (let i = form.copied; i < end; i++) {
        const r = readResponse(headers, rows[i]);
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(r.email)) {
          result.skipped += 1;
        } else {
          const [first, ...rest] = r.name.split(/\s+/);
          if (!r.name) {
            result.skipped += 1;
            form.copied = i + 1;
            continue;
          }
          await recordSubmission(form.kind, {
            firstName: first ?? "",
            lastName: rest.join(" "),
            name: r.name,
            email: r.email,
            phone: r.phone,
            ...(form.kind === "volunteer"
              ? { volunteerInterests: form.name, comments: r.details }
              : { event: form.name, details: r.details }),
          }, { timestamp: String(rows[i][0] ?? ""), source: `Google Form: ${form.name}` });
          summary.copied += 1;
          result.copied += 1;
        }
        form.copied = i + 1;
      }
      summary.waiting = rows.length - form.copied;
      form.lastError = undefined;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      form.lastError = message;
      summary.error = message;
      result.errors.push(`${form.name}: ${message}`);
    }
    form.lastRun = new Date().toISOString();
    result.forms.push(summary);
  }

  await saveForms(forms);
  return result;
}
