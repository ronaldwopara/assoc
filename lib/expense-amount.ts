/**
 * Finding the amount on a bill or receipt. Many (Google Workspace, Square…)
 * only put it in the attached PDF, so the PDF's text is read too.
 *
 * Handles "$1,234.56", "CA$16.88", "16.88 CAD", and French-style "1 234,56 $" / "250,00$".
 */

import { extractText, getDocumentProxy } from "unpdf";

// One capture group per format: English with $ in front, English with $/CAD after, French with comma decimals.
const MONEY = String.raw`(?:CA|C|US|CAD|USD)?\s?\$\s?([\d,]+\.\d{2})|([\d,]+\.\d{2})\s?(?:CAD|USD|\$)|((?:\d{1,3}(?:[ . ]\d{3})+|\d+),\d{2})\s?\$`;

const LABEL = String.raw`(?:amount\s+due|total\s+due|balance\s+due|\bbalance\b|grand\s+total|total\s+amount|amount\s+paid|amount\s+received|payment\s+amount|total\s+payment|total\s+paid|total\s+charged|amount\s+charged|total\s+in\s+\w+|\btotal\b)`;

function toNumber(m: RegExpMatchArray): number {
  if (m[1] ?? m[2]) return Number(String(m[1] ?? m[2]).replace(/,/g, ""));
  if (m[3]) return Number(m[3].replace(/[ . ]/g, "").replace(",", "."));
  return 0;
}

/** The total on a bill/receipt: a "Total / Amount due / Balance / Amount paid" line if there is one, else the largest amount. */
export function findAmount(text: string): string {
  const t = text.replace(/ /g, " ").replace(/[ \t]+/g, " ");
  const largest = (nums: number[]) => {
    const ok = nums.filter((n) => Number.isFinite(n) && n > 0);
    return ok.length ? Math.max(...ok).toFixed(2) : "";
  };

  const labelled = largest([...t.matchAll(new RegExp(`${LABEL}[^\\n\\d$]{0,40}(?:${MONEY})`, "gi"))].map(toNumber));
  if (labelled) return labelled;

  const anyMoney = largest([...t.matchAll(new RegExp(MONEY, "g"))].map(toNumber));
  if (anyMoney) return anyMoney;

  // Last resort for bills that print amounts without a currency sign ("Amount 50.00").
  if (/invoice|receipt|amount|total/i.test(t)) {
    return largest([...t.matchAll(/(?<![\d.,])(\d{1,6}(?:,\d{3})*\.\d{2})(?![\d.])/g)].map((m) => Number(m[1].replace(/,/g, ""))));
  }
  return "";
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
