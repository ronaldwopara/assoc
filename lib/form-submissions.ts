/**
 * Website form submissions → master sheet.
 *
 * Every form writes one row to its own tab and one row to Master List
 * (Source = the form). Membership has no tab of its own: its full details live
 * on the Master List row. Membership and donation signups get a payment code
 * (M-1234 / D-1234) that payers put in the e-Transfer message so the payment
 * can be tied back to this exact signup.
 */

import { randomInt } from "node:crypto";
import { appendSheetRow, ensureSheetTab, getAccessTokenForAccount, getSheetValues, updateSheetRow } from "@/lib/google-sheets";
import { membershipCategoryOptions } from "@/lib/join-community-forms";
import { MASTER_HEADERS, MASTER_TABS, colIndex, masterSheetId, rowFromFields } from "@/lib/master-sheet";
import { formatTimestamp, parseSheetDate } from "@/lib/sheet-dates";
import { autoConfirm } from "@/lib/email-dispatch";
import { notify } from "@/lib/push";
import { SENDER_EMAIL, sendEmail } from "@/lib/mailer";

export const FORM_KINDS = ["membership", "donate", "volunteer", "vendor", "contact", "newsletter"] as const;
/** Website form kinds, plus "event" (registrations copied in from event Google Forms; not a public form). */
export type FormKind = (typeof FORM_KINDS)[number] | "event";

export function isFormKind(value: string): value is FormKind {
  return (FORM_KINDS as readonly string[]).includes(value);
}

type Values = Record<string, string | string[] | undefined>;

/** Tab whose row gets the confirmation email (membership has no tab of its own). */
const CONFIRM_TAB: Record<FormKind, keyof typeof MASTER_TABS> = {
  membership: "masterList",
  donate: "donations",
  volunteer: "volunteers",
  vendor: "vendors",
  contact: "contact",
  newsletter: "newsletter",
  event: "registrations",
};

const SOURCE_LABEL: Record<FormKind, string> = {
  membership: "Membership",
  donate: "Donation",
  volunteer: "Volunteer",
  vendor: "Vendor",
  contact: "Contact",
  newsletter: "Newsletter",
  event: "Event",
};

const MAX_FIELD_LENGTH = 5000;

function str(values: Values, key: string): string {
  const v = values[key];
  const s = Array.isArray(v) ? v.join(", ") : String(v ?? "");
  return s.trim().slice(0, MAX_FIELD_LENGTH);
}

function fullName(values: Values): string {
  return [str(values, "firstName"), str(values, "lastName")].filter(Boolean).join(" ") || str(values, "name");
}

function paymentMethodLabel(method: string): string {
  if (method === "card") return "Card";
  if (method === "etransfer") return "e-Transfer";
  return method;
}

function membershipCategoryLabel(value: string): string {
  const category = membershipCategoryOptions.find((option) => option.value === value);
  return category ? `${category.title} (${category.price})` : value;
}

function donationAmount(values: Values): string {
  const amount = str(values, "donationAmount");
  return amount === "custom" ? str(values, "customAmount") : amount;
}

/** "Label: value" lines for the fields that don't have their own column. */
function details(values: Values, fields: Array<[key: string, label: string]>): string {
  return fields
    .map(([key, label]) => [label, str(values, key)] as const)
    .filter(([, v]) => v)
    .map(([label, v]) => `${label}: ${v}`)
    .join("\n");
}

const MEMBERSHIP_DETAIL_FIELDS: Array<[string, string]> = [
  ["address", "Address"],
  ["age", "Age"],
  ["gender", "Gender"],
  ["countryOfOrigin", "Country of origin"],
  ["spouseName", "Spouse"],
  ["spouseEmail", "Spouse email"],
  ["spousePhone", "Spouse phone"],
  ["spouseAddress", "Spouse address"],
  ["spouseConsent", "Spouse consents to updates"],
  ["registerChildren", "Register children"],
  ["childrenCount", "Number of children"],
  ["childrenAges", "Children's ages"],
  ["membershipParticipation", "Wants to help with"],
  ["consent", "Consents to updates"],
  ["comments", "Comments"],
];

const VENDOR_DETAIL_FIELDS: Array<[string, string]> = [
  ["website", "Website / social"],
  ["africanCultureRegion", "Culture / region"],
  ["boothRequired", "Needs booth"],
  ["electricityRequired", "Needs electricity"],
  ["boothEquipment", "Booth equipment"],
  ["waterRequired", "Needs water"],
  ["businessLicense", "Business licence"],
  ["liabilityInsurance", "Liability insurance"],
  ["hearAbout", "Heard about us"],
  ["comments", "Comments"],
  ["vendorApprovalUnderstanding", "Understands approval"],
  ["vendorGuidelinesAgreement", "Agrees to guidelines"],
];

/** A code not already used anywhere on Master List, Donations or Vendors. */
export async function newPaymentCode(accessToken: string, spreadsheetId: string, prefix: "M" | "D" | "V"): Promise<string> {
  const used = new Set<string>();
  for (const tab of [MASTER_TABS.masterList, MASTER_TABS.donations, MASTER_TABS.vendors]) {
    const [headers = [], ...rows] = await getSheetValues(accessToken, spreadsheetId, tab);
    const col = colIndex(headers, "Payment Code");
    if (col >= 0) rows.forEach((r) => used.add(String(r[col] ?? "").trim().toUpperCase()));
  }
  for (let i = 0; i < 50; i++) {
    const code = `${prefix}-${randomInt(1000, 10000)}`;
    if (!used.has(code)) return code;
  }
  throw new Error("Couldn't generate a unique payment code");
}

export type SubmissionResult = { paymentCode?: string };

/** A resubmission refreshes an existing row: new values win, blanks keep the old value, `clear` columns are emptied. */
export function mergeRow(headers: string[], row: string[], fields: Record<string, string>, clear: string[] = []): string[] {
  const merged = headers.map((h, c) => {
    const next = fields[h.trim()];
    return next !== undefined && next !== "" ? next : String(row[c] ?? "");
  });
  for (const col of clear) {
    const c = colIndex(headers, col);
    if (c >= 0) merged[c] = "";
  }
  return merged;
}

export type SubmissionOptions = {
  /** When it was originally submitted (copying old responses in); defaults to now. */
  timestamp?: string;
  /** Copying history in: no confirmation email, stamped "Imported", and a newer date already on a row is kept. */
  quiet?: boolean;
  /** Where it came from, for the Form Log ("Website", "Google Form: African Festival"…). */
  source?: string;
};

/** What each form is called in the Form Log and notifications. */
const FORM_LABEL: Record<FormKind, string> = {
  membership: "Membership",
  donate: "Donation",
  volunteer: "Volunteer",
  vendor: "Vendor application",
  contact: "Contact message",
  newsletter: "Newsletter",
  event: "Event registration",
};

const esc = (v: string) => v.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

/** Short heads-up to support@asosc.ca for every form that comes in (staff email, sent even while public emails are paused). */
async function emailStaff(f: { form: string; returning: boolean; name: string; email: string; phone: string; detail: string; from: string; at: string }) {
  const rows: Array<[string, string]> = [
    ["Form", f.form + (f.returning ? " (they've signed up before)" : "")],
    ["Name", f.name],
    ["Email", f.email],
    ["Phone", f.phone],
    ["Details", f.detail],
    ["From", f.from],
    ["When", f.at],
  ].filter(([, v]) => v) as Array<[string, string]>;
  const dashboard = "https://asosc.ca/upgrade?tool=dashboard";
  await sendEmail({
    to: SENDER_EMAIL,
    subject: `New ${f.form.toLowerCase()}: ${f.name || f.email}`,
    text: `${rows.map(([k, v]) => `${k}: ${v}`).join("\n")}\n\nSee all forms: ${dashboard}`,
    html: `<div style="font-family:Avenir Next,Segoe UI,Arial,sans-serif;color:#2f2b28;font-size:15px;line-height:1.5">
<p style="margin:0 0 12px;font-weight:600">New ${esc(f.form.toLowerCase())}${f.returning ? " (returning)" : ""}</p>
<table cellpadding="0" cellspacing="0" style="border-collapse:collapse">${rows
      .map(([k, v]) => `<tr><td style="padding:4px 16px 4px 0;color:#6f6760;vertical-align:top">${esc(k)}</td><td style="padding:4px 0">${esc(v)}</td></tr>`)
      .join("")}</table>
<p style="margin:16px 0 0"><a href="${dashboard}" style="color:#c66518">Open the Form log</a></p></div>`,
    headers: { "X-ASOSC-Notice": "form-log", ...(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email) ? { "Reply-To": f.email } : {}) },
  });
}

export async function recordSubmission(kind: FormKind, values: Values, options: SubmissionOptions = {}): Promise<SubmissionResult> {
  const name = fullName(values);
  const email = str(values, "email").toLowerCase();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("A valid email is required.");
  if (!name && kind !== "newsletter") throw new Error("Your name is required.");

  const spreadsheetId = masterSheetId();
  const { accessToken } = await getAccessTokenForAccount();
  const quiet = Boolean(options.quiet);
  const person = {
    Timestamp: options.timestamp?.trim() || formatTimestamp(new Date()),
    "Full Name": name,
    Email: email,
    "Phone Number": str(values, "phone"),
  };

  const sameEmail = (headers: string[], row: string[]) =>
    String(row[colIndex(headers, "Email")] ?? "").trim().toLowerCase() === email;
  const cellOf = (headers: string[], row: string[], col: string) => String(row[colIndex(headers, col)] ?? "").trim();
  const isUnpaidMembership = (headers: string[], row: string[]) =>
    sameEmail(headers, row) &&
    /^membership$/i.test(cellOf(headers, row, "Source")) &&
    !/^paid$/i.test(cellOf(headers, row, "Paid"));

  // An unpaid member signing up again keeps the payment code they were already given.
  let paymentCode: string | undefined;
  if (kind === "membership") {
    const [headers = [], ...rows] = await getSheetValues(accessToken, spreadsheetId, MASTER_TABS.masterList);
    const existing = [...rows].reverse().find((r) => isUnpaidMembership(headers, r));
    paymentCode = (existing && cellOf(headers, existing, "Payment Code")) || undefined;
  }
  if (!paymentCode && (kind === "membership" || kind === "donate")) {
    paymentCode = await newPaymentCode(accessToken, spreadsheetId, kind === "membership" ? "M" : "D");
  }

  const masterFields: Record<string, string> = { ...person, Source: SOURCE_LABEL[kind] };
  const rowNumbers: Partial<Record<keyof typeof MASTER_TABS, number>> = {};
  /** Tabs where an existing row was refreshed instead of a new one added. */
  const refreshed = new Set<keyof typeof MASTER_TABS>();

  /**
   * Saves the submission to a tab. With `update`, a row for the same person
   * (same email, plus `match`) is refreshed in place (new date and details,
   * anything left blank keeps its old value) instead of adding a duplicate.
   * `clear` columns are emptied on update so the person is treated as new
   * (e.g. a fresh confirmation email, reminders restarted).
   */
  const save = async (
    tab: keyof typeof MASTER_TABS,
    fields: Record<string, string>,
    opts: { update?: boolean; match?: (headers: string[], row: string[]) => boolean; clear?: string[] } = {},
  ) => {
    const name = MASTER_TABS[tab];
    let values: string[][];
    try {
      values = await getSheetValues(accessToken, spreadsheetId, name);
    } catch {
      // Tab added to the schema after the sheet was built (e.g. Event Registrations).
      await ensureSheetTab(accessToken, spreadsheetId, name);
      values = [];
    }
    if (values.length === 0) {
      await updateSheetRow(accessToken, spreadsheetId, name, 1, [...MASTER_HEADERS[tab]]);
      values = [[...MASTER_HEADERS[tab]]];
    }
    const [liveHeaders = [], ...rows] = values;
    const headers = liveHeaders.length ? liveHeaders : [...MASTER_HEADERS[tab]];
    // Columns added to the schema after the tab was built (e.g. Volunteers' "From").
    const missing = MASTER_HEADERS[tab].filter((h) => colIndex(headers, h) < 0);
    if (missing.length) {
      headers.push(...missing);
      await updateSheetRow(accessToken, spreadsheetId, name, 1, headers);
    }
    if (opts.update) {
      const match = opts.match ?? sameEmail;
      for (let i = rows.length - 1; i >= 0; i--) {
        if (!match(headers, rows[i])) continue;
        const merged = mergeRow(headers, rows[i], fields, quiet ? [] : ["Confirmation Sent", ...(opts.clear ?? [])]);
        if (quiet) {
          // Copying an older response in: keep a newer date and an existing confirmation stamp.
          const t = colIndex(headers, "Timestamp");
          const was = parseSheetDate(String(rows[i][t] ?? ""))?.getTime() ?? 0;
          const now = parseSheetDate(fields.Timestamp ?? "")?.getTime() ?? 0;
          if (t >= 0 && was > now) merged[t] = String(rows[i][t] ?? "");
          const c = colIndex(headers, "Confirmation Sent");
          if (c >= 0 && !merged[c]) merged[c] = "Imported";
        }
        await updateSheetRow(accessToken, spreadsheetId, name, i + 2, merged);
        rowNumbers[tab] = i + 2;
        refreshed.add(tab);
        return;
      }
    }
    rowNumbers[tab] = await appendSheetRow(
      accessToken,
      spreadsheetId,
      name,
      rowFromFields(headers, quiet ? { ...fields, "Confirmation Sent": "Imported" } : fields),
    );
  };
  const append = (tab: keyof typeof MASTER_TABS, fields: Record<string, string>) => save(tab, fields);

  switch (kind) {
    case "membership": {
      const interacEmail =
        str(values, "interacEmail") || (str(values, "interacSame") === "Yes" ? email : "");
      Object.assign(masterFields, {
        "Membership Category": membershipCategoryLabel(str(values, "membershipCategory")),
        "Payment Method": paymentMethodLabel(str(values, "paymentMethod")),
        "Interac Email": interacEmail.toLowerCase(),
        "Payment Code": paymentCode!,
        "Membership Card URL": str(values, "membershipCardUrl"),
        Details: details(values, MEMBERSHIP_DETAIL_FIELDS),
        "Reminder Count": "0",
        "Reminder Round": "1",
      });
      break;
    }
    case "donate":
      await append("donations", {
        ...person,
        Amount: donationAmount(values),
        "Payment Method": paymentMethodLabel(str(values, "paymentMethod")),
        "Payment Code": paymentCode!,
      });
      break;
    case "volunteer": {
      // Event Google Forms pass source "Google Form: <name>"; everything else is the website form.
      const from = options.source?.replace(/^google form:\s*/i, "").trim() || "Website";
      await save("volunteers", {
        ...person,
        Interests: str(values, "volunteerInterests"),
        Comments: str(values, "comments"),
        From: from,
      }, {
        update: true,
        // Volunteering through a different form is its own row (African Festival and BHM are separate sign-ups).
        match: (h, r) => sameEmail(h, r) && (cellOf(h, r, "From") || "Website").toLowerCase() === from.toLowerCase(),
      });
      break;
    }
    case "vendor":
      await save("vendors", {
        ...person,
        "Business Name": str(values, "businessName"),
        "Vendor Type": str(values, "vendorType"),
        Description: str(values, "productsServices"),
        Details: details(values, VENDOR_DETAIL_FIELDS),
      }, { update: true });
      break;
    case "contact":
      await append("contact", { ...person, Message: str(values, "message") });
      break;
    case "event":
      await save("registrations", {
        ...person,
        Event: str(values, "event"),
        Details: str(values, "details"),
      }, {
        update: true,
        match: (h, r) => sameEmail(h, r) && cellOf(h, r, "Event").toLowerCase() === str(values, "event").toLowerCase(),
      });
      break;
    case "newsletter":
      await save("newsletter", {
        ...person,
        "Strathcona Resident": str(values, "strathconaResident"),
      }, { update: true });
      break;
  }

  // Master List: one row per person. Membership keeps its own row (payment code,
  // paid status and reminders live there; a paid member renewing gets a new one).
  // Every other sign-up refreshes the person's other row: newest date, and
  // "Signed up for" lists everything they've done ("Volunteer, Contact").
  if (kind === "membership") {
    await save("masterList", masterFields, {
      update: true,
      match: isUnpaidMembership,
      clear: ["Stop Reminders", "Last Reminder"],
    });
  } else {
    const [headers = [], ...rows] = await getSheetValues(accessToken, spreadsheetId, MASTER_TABS.masterList);
    const personRow = [...rows]
      .reverse()
      .find((r) => sameEmail(headers, r) && !/^membership$/i.test(cellOf(headers, r, "Source")));
    if (personRow) {
      const kinds = cellOf(headers, personRow, "Source")
        .split(/\s*,\s*/)
        .filter((k) => k && !/^imported$/i.test(k));
      if (!kinds.some((k) => k.toLowerCase() === SOURCE_LABEL[kind].toLowerCase())) kinds.push(SOURCE_LABEL[kind]);
      masterFields.Source = kinds.join(", ");
    }
    await save("masterList", masterFields, {
      update: true,
      match: (h, r) => sameEmail(h, r) && !/^membership$/i.test(cellOf(h, r, "Source")),
    });
  }

  const confirmTab = CONFIRM_TAB[kind];
  const confirmRow = rowNumbers[confirmTab];
  if (confirmRow && !quiet) await autoConfirm(MASTER_TABS[confirmTab], confirmRow);

  if (!quiet) {
    // Form Log row + a push notification to staff devices. Best effort: never fails the submission.
    const detail =
      kind === "membership" ? membershipCategoryLabel(str(values, "membershipCategory"))
      : kind === "donate" ? `$${donationAmount(values)}`
      : kind === "volunteer" ? str(values, "volunteerInterests")
      : kind === "vendor" ? str(values, "businessName")
      : kind === "event" ? str(values, "event")
      : kind === "contact" ? str(values, "message").slice(0, 140)
      : "";
    const returning = refreshed.has(confirmTab);
    const from = options.source || "Website";
    try {
      await save("formLog", {
        Timestamp: person.Timestamp,
        Form: FORM_LABEL[kind],
        "Full Name": name,
        Email: email,
        "Phone Number": person["Phone Number"],
        From: from,
        Details: detail,
        "New or returning": returning ? "Returning" : "New",
      });
    } catch (error) {
      console.error("[form log] couldn't write:", error);
    }
    await emailStaff({
      form: FORM_LABEL[kind],
      returning,
      name,
      email,
      phone: person["Phone Number"],
      detail,
      from,
      at: person.Timestamp,
    }).catch((error) => console.error("[form log] staff email failed:", error));
    await notify({
      title: `New ${FORM_LABEL[kind].toLowerCase()}${returning ? " (again)" : ""}`,
      body: [name || email, detail, from === "Website" ? "" : from].filter(Boolean).join(" · "),
      url: "/upgrade?tool=dashboard",
      tag: `form-${kind}`,
    }).catch(() => undefined);
  }

  return { paymentCode };
}
