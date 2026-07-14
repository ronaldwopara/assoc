import type { FormValues } from "@/components/guided-form";

export type FormDraft = {
  values: FormValues;
  stepIndex: number;
};

export type FormDraftMap = Record<string, FormDraft>;

const STORAGE_KEY = "asosc-join-community-drafts";
const MEMBER_NAME_KEY = "asosc-member-name";

/** Fired on window whenever drafts (and the remembered name) change. */
export const DRAFTS_CHANGED_EVENT = "asosc-drafts-changed";

export function readFormDrafts(): FormDraftMap {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as FormDraftMap;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function extractMemberName(drafts: FormDraftMap): string {
  for (const draft of Object.values(drafts)) {
    const first = String(draft.values.firstName ?? "").trim();
    const last = String(draft.values.lastName ?? "").trim();
    const full = [first, last].filter(Boolean).join(" ");
    if (full) return full;
  }
  return "";
}

/** Last name the visitor typed into any form; survives draft clears for the session. */
export function readSavedMemberName(): string {
  if (typeof window === "undefined") return "";
  try {
    return window.sessionStorage.getItem(MEMBER_NAME_KEY) ?? "";
  } catch {
    return "";
  }
}

export function writeFormDrafts(drafts: FormDraftMap) {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(drafts));
    const name = extractMemberName(drafts);
    if (name) window.sessionStorage.setItem(MEMBER_NAME_KEY, name);
    // Deferred: this can be called from inside a React state updater, and
    // listeners setState — dispatching synchronously would nest renders.
    window.setTimeout(() => window.dispatchEvent(new Event(DRAFTS_CHANGED_EVENT)), 0);
  } catch {
    // Quota / private mode — ignore.
  }
}

export function upsertFormDraft(drafts: FormDraftMap, formId: string, draft: FormDraft): FormDraftMap {
  return { ...drafts, [formId]: draft };
}

export function clearFormDraft(drafts: FormDraftMap, formId: string): FormDraftMap {
  if (!(formId in drafts)) return drafts;
  const next = { ...drafts };
  delete next[formId];
  return next;
}

export function serializeFormValues(values: FormValues): string {
  const keys = Object.keys(values).sort();
  const normalized: Record<string, FormValues[string]> = {};
  for (const key of keys) {
    normalized[key] = values[key];
  }
  return JSON.stringify(normalized);
}

export function isFormDraftDirty(
  values: FormValues,
  stepIndex: number,
  baselineValues: FormValues,
  baselineStepIndex = 0,
): boolean {
  if (stepIndex > baselineStepIndex) return true;
  return serializeFormValues(values) !== serializeFormValues(baselineValues);
}
