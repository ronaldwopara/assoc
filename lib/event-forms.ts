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
import { listGoogleAccounts } from "@/lib/google-oauth";
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
  /** The connected Google account the response sheet is shared with (any of them works). */
  account?: string;
  /** Rows before this were already there when the form was added: copied in without emailing anyone. */
  quietUntil?: number;
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

/** The connected accounts, as a readable list ("support@asosc.ca or africanssocietyofsc@gmail.com"). */
async function connectedAccountsText(): Promise<string> {
  const emails = (await listGoogleAccounts()).map((a) => a.email);
  return emails.length > 1 ? `${emails.slice(0, -1).join(", ")} or ${emails.at(-1)}` : emails[0] ?? "an ASOSC Google account";
}

/** Finds a connected account that can open the sheet (the one it worked with last time first). */
async function openSheet(sheetId: string, preferred?: string): Promise<{ accessToken: string; email: string; tabs: string[] }> {
  const emails = (await listGoogleAccounts()).map((a) => a.email);
  const order = preferred ? [preferred, ...emails.filter((e) => e.toLowerCase() !== preferred.toLowerCase())] : emails;
  for (const email of order) {
    try {
      const { accessToken } = await getAccessTokenForAccount(email);
      const meta = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}?fields=sheets.properties.title`, {
        headers: { Authorization: `Bearer ${accessToken}` },
        cache: "no-store",
      });
      if (!meta.ok) continue;
      const tabs = ((await meta.json()) as { sheets?: Array<{ properties: { title: string } }> }).sheets?.map((x) => x.properties.title) ?? [];
      return { accessToken, email, tabs };
    } catch {
      // That account isn't usable right now; try the next one.
    }
  }
  throw new Error(`The website can't open that spreadsheet. Share it with ${await connectedAccountsText()} (Viewer is enough) and try again.`);
}

export type FormPreview = {
  title: string;
  /** The sheet title tidied into a name ("ASOSC Youth Council (Responses)" → "Youth Council"). */
  suggestedName: string;
  tab: string;
  responses: number;
  /** Responses with a usable name and email (the ones that will be added). */
  usable: number;
  sample: Array<{ name: string; email: string }>;
  lastResponse?: string;
  emailFound: boolean;
  alreadyAdded?: string;
};

/** Reads a pasted response sheet so staff can check it's the right one before adding it. */
export async function previewEventForm(link: string): Promise<FormPreview> {
  const sheetId = sheetIdFromLink(link);
  if (!sheetId) throw new Error("That doesn't look like a Google Sheets link. It should start with docs.google.com/spreadsheets.");
  const { accessToken, tabs } = await openSheet(sheetId);
  const tab = tabs.find((t) => /form responses/i.test(t)) || tabs[0];
  if (!tab) throw new Error("That spreadsheet is empty.");
  const titleRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}?fields=properties.title`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });
  const title = titleRes.ok ? ((await titleRes.json()) as { properties?: { title?: string } }).properties?.title ?? "" : "";
  const [headers = [], ...rows] = await getSheetValues(accessToken, sheetId, tab);
  const people = rows.map((r) => readResponse(headers, r)).filter((r) => r.name && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(r.email));
  const existing = (await listEventForms()).find((f) => f.sheetId === sheetId && f.tab === tab);
  return {
    title,
    suggestedName: tidyTitle(title),
    tab,
    responses: rows.length,
    usable: people.length,
    sample: people.slice(-3).reverse().map((p) => ({ name: p.name, email: p.email })),
    lastResponse: rows.at(-1)?.[0] || undefined,
    emailFound: headers.some((h) => /e-?mail/i.test(h)),
    alreadyAdded: existing?.name,
  };
}

function tidyTitle(title: string): string {
  return title
    .replace(/\((form\s+)?responses?\)/gi, "")
    .replace(/^\s*copy of\s+/i, "")
    .replace(/\b(google\s+form|sign[- ]?up\s+form|registration\s+form|form)\b/gi, "")
    .replace(/\s*([-–—:|]\s*){2,}/g, " - ")
    .replace(/^\s*(asosc|africans society of strathcona county)\b\s*[-–—:|]*\s*/i, "")
    // The page already says whether they're guests or volunteers.
    .replace(/^\s*(guests?|volunteers?|registrations?|attendees?)\s*[-–—:|]+\s*/i, "")
    .replace(/^\s*[-–—:|]+\s*|\s*[-–—:|]+\s*$/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

/** Pulls the spreadsheet id out of a pasted link (or accepts a bare id). */
export function sheetIdFromLink(link: string): string | null {
  const m = link.match(/\/spreadsheets\/d\/([A-Za-z0-9_-]{20,})/) ?? link.trim().match(/^([A-Za-z0-9_-]{20,})$/);
  return m ? m[1] : null;
}

/**
 * Adds a form after checking the site can read its response sheet. With
 * `importExisting`, people who already filled it in are copied in too (no
 * emails), via importEventForm; otherwise only new responses are copied.
 */
export async function addEventForm(input: { name: string; kind: EventFormKind; link: string; tab?: string; importExisting?: boolean }): Promise<EventForm> {
  const sheetId = sheetIdFromLink(input.link);
  if (!sheetId) throw new Error("Paste the link to the form's response spreadsheet (it starts with docs.google.com/spreadsheets).");
  const name = input.name.trim().slice(0, 120);
  if (!name) throw new Error("Give the form a name, like the event it's for.");
  const { accessToken, email, tabs } = await openSheet(sheetId);
  const tab = input.tab?.trim() || tabs.find((t) => /form responses/i.test(t)) || tabs[0];
  if (!tab || !tabs.includes(tab)) throw new Error(`That spreadsheet has no tab called "${input.tab}".`);
  const existing = await listEventForms();
  if (existing.some((f) => f.sheetId === sheetId && f.tab === tab)) throw new Error("That form is already being copied in.");
  const form: EventForm = { id: randomBytes(4).toString("hex"), name, kind: input.kind === "event" ? "event" : "volunteer", sheetId, tab, copied: null, account: email };
  if (input.importExisting) {
    const [, ...rows] = await getSheetValues(accessToken, sheetId, tab);
    form.copied = 0;
    form.quietUntil = rows.length;
  }
  await saveForms([...existing, form]);
  return form;
}

/** Copies one response into the master sheet (Volunteers or Event Registrations + Master List). False if it has no usable name/email. */
async function copyResponse(form: EventForm, headers: string[], row: string[], quiet: boolean): Promise<boolean> {
  const r = readResponse(headers, row);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(r.email) || !r.name) return false;
  const [first, ...rest] = r.name.split(/\s+/);
  await recordSubmission(
    form.kind,
    {
      firstName: first ?? "",
      lastName: rest.join(" "),
      name: r.name,
      email: r.email,
      phone: r.phone,
      ...(form.kind === "volunteer" ? { volunteerInterests: form.name, comments: r.details } : { event: form.name, details: r.details }),
    },
    { timestamp: String(row[0] ?? ""), source: `Google Form: ${form.name}`, quiet },
  );
  return true;
}

/** A form's responses, read through whichever connected account it's shared with (remembered on the form). */
async function readFormSheet(form: EventForm): Promise<string[][]> {
  if (form.account) {
    try {
      const { accessToken } = await getAccessTokenForAccount(form.account);
      return await getSheetValues(accessToken, form.sheetId, form.tab);
    } catch (error) {
      if (isRateLimit(error)) throw error;
      // Unshared from that account, or it was disconnected: look for another below.
    }
  }
  const { accessToken, email } = await openSheet(form.sheetId, form.account);
  form.account = email;
  return getSheetValues(accessToken, form.sheetId, form.tab);
}

export type ImportProgress = { copied: number; skipped: number; remaining: number; total: number; waitSeconds?: number };

/**
 * Copies in a newly added form's earlier responses (no emails), for up to
 * `budgetMs` so it fits in one request. Call again while `remaining` > 0;
 * `waitSeconds` means Google's rate limit was hit, so wait that long first.
 * The daily run also finishes anything left, still without emails.
 */
export async function importEventForm(id: string, budgetMs = 25_000): Promise<ImportProgress> {
  try {
    return await importBatch(id, budgetMs);
  } catch (error) {
    // Google's per-minute read limit: nothing is lost, the caller just waits and calls again.
    if (!isRateLimit(error)) throw error;
    const form = (await listEventForms().catch(() => [])).find((f) => f.id === id);
    const total = form?.quietUntil ?? 0;
    return { copied: 0, skipped: 0, remaining: Math.max(1, total - (form?.copied ?? 0)), total, waitSeconds: 60 };
  }
}

const isRateLimit = (error: unknown) => /quota|rate limit|429/i.test(String(error));
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Saves progress, riding out a short rate limit so finished work isn't lost. */
async function saveFormsRetrying(forms: EventForm[]) {
  for (let attempt = 0; ; attempt++) {
    try {
      return await saveForms(forms);
    } catch (error) {
      if (!isRateLimit(error) || attempt >= 2) throw error;
      await sleep(15_000);
    }
  }
}

async function importBatch(id: string, budgetMs: number): Promise<ImportProgress> {
  const started = Date.now();
  const forms = await listEventForms();
  const form = forms.find((f) => f.id === id);
  if (!form) throw new Error("Form not found");
  const total = form.quietUntil ?? 0;
  const progress: ImportProgress = { copied: 0, skipped: 0, remaining: Math.max(0, total - (form.copied ?? 0)), total };
  if (!progress.remaining) return progress;

  const [headers = [], ...rows] = await readFormSheet(form);
  const end = Math.min(total, rows.length);
  try {
    for (let i = form.copied ?? 0; i < end; i++) {
      if (Date.now() - started > budgetMs) break;
      if (await copyResponse(form, headers, rows[i], true)) progress.copied += 1;
      else progress.skipped += 1;
      form.copied = i + 1;
    }
  } catch (error) {
    if (!isRateLimit(error)) throw error;
    progress.waitSeconds = 60;
  } finally {
    progress.remaining = Math.max(0, end - (form.copied ?? 0));
    if (!progress.remaining) form.quietUntil = undefined;
    await saveFormsRetrying(forms);
  }
  return progress;
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
  const result: EventFormRunResult = { copied: 0, skipped: 0, errors: [], forms: [] };

  for (const form of forms) {
    const summary = { name: form.name, copied: 0, waiting: 0 } as EventFormRunResult["forms"][number];
    try {
      const [headers = [], ...rows] = await readFormSheet(form);
      // First run: start from now, so people who signed up months ago aren't emailed.
      if (form.copied === null) form.copied = rows.length;
      // Rows deleted from the response sheet: don't go backwards.
      if (form.copied > rows.length) form.copied = rows.length;

      const end = Math.min(rows.length, form.copied + MAX_PER_RUN);
      for (let i = form.copied; i < end; i++) {
        // Responses from before the form was added (an import still finishing) aren't emailed.
        const quiet = form.quietUntil !== undefined && i < form.quietUntil;
        if (await copyResponse(form, headers, rows[i], quiet)) {
          summary.copied += 1;
          result.copied += 1;
        } else {
          result.skipped += 1;
        }
        form.copied = i + 1;
      }
      if (form.quietUntil !== undefined && form.copied >= form.quietUntil) form.quietUntil = undefined;
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
