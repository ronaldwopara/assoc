import {
  ensureSheetTab,
  getAccessTokenForAccount,
  getSheetRange,
  updateSheetRange,
} from "@/lib/google-sheets";
import { resolveDashboardSheetId } from "@/lib/dashboard-sheets";
import { defaultMembershipEmailTemplate, type MembershipEmailTemplate } from "@/lib/membership-email-render";

export type { MembershipEmailTemplate } from "@/lib/membership-email-render";

/** Same tab Membershipfollowup.gs reads via mbReadTemplate() — keep this name in sync with MB.TEMPLATE_TAB. */
export const MEMBERSHIP_EMAIL_TEMPLATE_TAB = "Membership Email";

/** A1 = body, B1 = subject, B2 = button label, B3 = button URL, B4 = preheader, B5 = payment confirmation block. */
function templateFromRange(values: string[][]): MembershipEmailTemplate {
  const cell = (row: number, col: number) => String(values[row]?.[col] ?? "").trim();
  const fallback = defaultMembershipEmailTemplate();

  return {
    body: cell(0, 0) || fallback.body,
    subject: cell(0, 1) || fallback.subject,
    buttonLabel: cell(1, 1) || fallback.buttonLabel,
    buttonUrl: cell(2, 1) || fallback.buttonUrl,
    preheader: cell(3, 1),
    paymentBlock: cell(4, 1) || fallback.paymentBlock,
  };
}

function templateToRange(template: MembershipEmailTemplate): string[][] {
  return [
    [template.body, template.subject],
    ["", template.buttonLabel],
    ["", template.buttonUrl],
    ["", template.preheader],
    ["", template.paymentBlock],
  ];
}

/** Reads the template, self-healing the "Membership Email" tab with defaults if it doesn't exist yet. */
export async function getMembershipEmailTemplate(): Promise<MembershipEmailTemplate> {
  const spreadsheetId = resolveDashboardSheetId("membership");
  const { accessToken } = await getAccessTokenForAccount();

  await ensureSheetTab(accessToken, spreadsheetId, MEMBERSHIP_EMAIL_TEMPLATE_TAB);
  const values = await getSheetRange(accessToken, spreadsheetId, MEMBERSHIP_EMAIL_TEMPLATE_TAB, "A1:B5");

  if (!values.length) {
    const defaults = defaultMembershipEmailTemplate();
    await updateSheetRange(
      accessToken,
      spreadsheetId,
      MEMBERSHIP_EMAIL_TEMPLATE_TAB,
      "A1:B5",
      templateToRange(defaults),
    );
    return defaults;
  }

  return templateFromRange(values);
}

export async function saveMembershipEmailTemplate(template: MembershipEmailTemplate): Promise<void> {
  const spreadsheetId = resolveDashboardSheetId("membership");
  const { accessToken } = await getAccessTokenForAccount();

  await ensureSheetTab(accessToken, spreadsheetId, MEMBERSHIP_EMAIL_TEMPLATE_TAB);
  await updateSheetRange(
    accessToken,
    spreadsheetId,
    MEMBERSHIP_EMAIL_TEMPLATE_TAB,
    "A1:B5",
    templateToRange(template),
  );
}
