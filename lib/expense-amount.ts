/**
 * Finding the amount on a bill or receipt. Many (Google Workspace, Square…)
 * only put it in the attached PDF, so the PDF's text is read too.
 */

import { extractText, getDocumentProxy } from "unpdf";

const MONEY = String.raw`(?:CA|C|US|CAD|USD)?\s?\$\s?([\d,]+\.\d{2})|([\d,]+\.\d{2})\s?(?:CAD|USD|\$)`;

/** The total on a bill/receipt: a "Total / Amount due / Amount paid" line if there is one, else the largest amount. */
export function findAmount(text: string): string {
  const t = text.replace(/ /g, " ").replace(/[ \t]+/g, " ");
  const labelled = new RegExp(
    String.raw`(?:amount\s+due|total\s+due|balance\s+due|grand\s+total|total\s+amount|amount\s+paid|total\s+paid|total\s+charged|total\s+in\s+\w+|\btotal\b)[^\n\d$]{0,40}(?:${MONEY})`,
    "gi",
  );
  const hits = [...t.matchAll(labelled)].map((m) => m[1] ?? m[2]).filter(Boolean);
  const pick = (vals: string[]) => vals.map((v) => Number(v.replace(/,/g, ""))).filter((n) => n > 0);
  const labelledNums = pick(hits);
  if (labelledNums.length) return Math.max(...labelledNums).toFixed(2);
  const any = pick([...t.matchAll(new RegExp(MONEY, "g"))].map((m) => m[1] ?? m[2]).filter(Boolean));
  return any.length ? Math.max(...any).toFixed(2) : "";
}

/** Plain text of a PDF, or "" if it can't be read. */
export async function pdfText(bytes: Uint8Array): Promise<string> {
  try {
    const pdf = await getDocumentProxy(bytes);
    const { text } = await extractText(pdf, { mergePages: true });
    return Array.isArray(text) ? text.join("\n") : text;
  } catch {
    return "";
  }
}
