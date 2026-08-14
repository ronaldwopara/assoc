/**
 * Isomorphic (client + server) pieces of the membership follow-up email —
 * types, defaults, and the placeholder renderer. Safe to import from a
 * client component; the Sheets read/write lives in membership-email-template.ts.
 */

export interface MembershipEmailTemplate {
  body: string;
  subject: string;
  buttonLabel: string;
  buttonUrl: string;
  preheader: string;
  /** Payment confirmation line — same wording for every payment method; only {{payment_method}} varies. */
  paymentBlock: string;
}

export interface MembershipEmailSample {
  name: string;
  firstName: string;
  email: string;
  category: string;
  amount: number;
  method: string;
}

export function defaultMembershipEmailBody(): string {
  return [
    "Hi {{first_name}},",
    "",
    "Thanks for signing up for an ASOSC membership. We have your details down for the {{category}}.",
    "",
    "{{payment_instructions}}",
    "",
    "Once your payment comes through we will mark your membership active and sort out your membership card.",
    "",
    "If anything here looks wrong, reply to this email and we will fix it.",
    "",
    "Busayo Disu",
    "President",
    "Africans Society of Strathcona County",
  ].join("\n");
}

export function defaultMembershipPaymentBlock(): string {
  return "We are processing your {{payment_method}} payment of {{amount}}. Nothing else is needed from you.";
}

export function defaultMembershipEmailTemplate(): MembershipEmailTemplate {
  return {
    body: defaultMembershipEmailBody(),
    subject: "Your ASOSC membership — one step left",
    buttonLabel: "See what is coming up",
    buttonUrl: "https://www.asosc.ca/events",
    preheader: "",
    paymentBlock: defaultMembershipPaymentBlock(),
  };
}

function moneyFormat(n: number): string {
  return isFinite(n) && n > 0 ? "$" + n.toFixed(2) : "your membership fee";
}

/** Mirrors mbRenderBody() in Membershipfollowup.gs so the preview matches exactly what gets sent. */
export function renderMembershipEmailBody(
  template: MembershipEmailTemplate,
  sample: MembershipEmailSample,
): string {
  const fill = (s: string) =>
    String(s)
      .replace(/\{\{first_name\}\}/g, sample.firstName || "there")
      .replace(/\{\{name\}\}/g, sample.name || "there")
      .replace(/\{\{category\}\}/g, sample.category || "membership")
      .replace(/\{\{amount\}\}/g, moneyFormat(sample.amount))
      .replace(/\{\{payment_method\}\}/g, (sample.method || "").toLowerCase())
      .replace(/\{\{email\}\}/g, sample.email || "");

  return fill(template.body.replace(/\{\{payment_instructions\}\}/g, fill(template.paymentBlock)))
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export const MEMBERSHIP_EMAIL_PREVIEW_SAMPLES: MembershipEmailSample[] = [
  {
    name: "Sample Org",
    firstName: "Sample",
    email: "sample@example.com",
    category: "Organizational Membership ($100CAD)",
    amount: 100,
    method: "Card",
  },
];
