/**
 * Isomorphic (client + server) pieces of the 5 non-membership follow-up
 * emails — types, defaults, and placeholder renderers, one per flow, each
 * mirroring its own Apps Script (e.g. dnRenderBody() in
 * emails/Donate/Donatefollowup.gs). The Sheets read/write lives in
 * lib/flow-email-template.ts.
 */

import type { DashboardSheetSource } from "@/lib/dashboard-sheets";

export type EmailFlowId = "donate" | "contact" | "newsletter" | "vendors" | "volunteer";

export interface FlowEmailTemplate {
  body: string;
  subject: string;
  buttonLabel: string;
  buttonUrl: string;
  preheader: string;
  /** Donate only — swapped into {{payment_instructions}} by payment method. */
  etransferBlock?: string;
  cardBlock?: string;
  /** Newsletter only — per-recipient link is generated at send time; this is the fallback. */
  unsubscribe?: string;
}

export interface FlowEmailSample {
  name: string;
  firstName: string;
  email: string;
  amount?: number;
  method?: string;
  message?: string;
  businessName?: string;
  vendorType?: string;
  interests?: string;
}

const DONATE_ETRANSFER_TO = "info@asosc.ca";
const NEWSLETTER_UNSUBSCRIBE_FALLBACK = "mailto:info@asosc.ca?subject=Unsubscribe%20from%20newsletter";

export const FLOW_META: Record<
  EmailFlowId,
  {
    title: string;
    sheetTab: string;
    source: DashboardSheetSource;
    placeholders: string[];
    hasPaymentBlocks: boolean;
    hasUnsubscribe: boolean;
  }
> = {
  donate: {
    title: "Donate",
    sheetTab: "Thank You Email",
    source: "donor",
    placeholders: ["{{first_name}}", "{{name}}", "{{amount}}", "{{method}}", "{{payment_instructions}}"],
    hasPaymentBlocks: true,
    hasUnsubscribe: false,
  },
  contact: {
    title: "Contact",
    sheetTab: "Reply Email",
    source: "contact",
    placeholders: ["{{first_name}}", "{{name}}", "{{message}}"],
    hasPaymentBlocks: false,
    hasUnsubscribe: false,
  },
  newsletter: {
    title: "Newsletter",
    sheetTab: "Confirmation Email",
    source: "newsletter",
    placeholders: ["{{first_name}}", "{{name}}"],
    hasPaymentBlocks: false,
    hasUnsubscribe: true,
  },
  vendors: {
    title: "Vendors",
    sheetTab: "Vendor Reply Email",
    source: "vendor",
    placeholders: ["{{first_name}}", "{{name}}", "{{business_name}}", "{{vendor_type}}"],
    hasPaymentBlocks: false,
    hasUnsubscribe: false,
  },
  volunteer: {
    title: "Volunteer",
    sheetTab: "Follow-up Email",
    source: "volunteer",
    placeholders: ["{{first_name}}", "{{name}}", "{{interests}}"],
    hasPaymentBlocks: false,
    hasUnsubscribe: false,
  },
};

function moneyFormat(n: number | undefined, fallback: string): string {
  return typeof n === "number" && isFinite(n) && n > 0 ? "$" + n.toFixed(2) : fallback;
}

function defaultBody(flow: EmailFlowId): string {
  switch (flow) {
    case "donate":
      return [
        "Hi {{first_name}},",
        "",
        "Thank you for choosing to support ASOSC with a gift of {{amount}}.",
        "",
        "{{payment_instructions}}",
        "",
        "Your donation goes straight into the work: cultural celebrations, youth programming, wellness sessions, and community outreach across Strathcona County.",
        "",
        "If you need anything for your records, reply to this email and we will sort it out.",
        "",
        "Busayo Disu",
        "President",
        "Africans Society of Strathcona County",
      ].join("\n");
    case "contact":
      return [
        "Hi {{first_name}},",
        "",
        "Thanks for getting in touch with ASOSC. Your message came through and we have it.",
        "",
        "This is what you sent us:",
        "",
        "{{message}}",
        "",
        "Someone will get back to you within a few business days. If it is time sensitive, like an event happening this week, reply to this email and say so and we will move it up the queue.",
        "",
        "Busayo Disu",
        "President",
        "Africans Society of Strathcona County",
      ].join("\n");
    case "newsletter":
      return [
        "Hi {{first_name}},",
        "",
        "You are on the list. Thanks for subscribing to the ASOSC newsletter.",
        "",
        "We send an update roughly once a month, and a bit more often in the weeks before something big like the African Festival. It covers what is coming up, how to get involved, and what has been happening around Strathcona County.",
        "",
        "That is the only thing we will use your email address for, and we do not share it with anyone.",
        "",
        "If you change your mind, every newsletter has an unsubscribe link at the bottom, or you can reply to this message and we will take you off the list.",
        "",
        "Busayo Disu",
        "President",
        "Africans Society of Strathcona County",
      ].join("\n");
    case "vendors":
      return [
        "Hi {{first_name}},",
        "",
        "Thanks for applying to be a vendor with ASOSC. We have your application for {{business_name}}.",
        "",
        "To be clear about where this stands: it confirms we received your form, it is not an approval. We go through every application and get in touch with selected vendors about next steps, including booth details, timing, and what to bring on the day.",
        "",
        "You will hear from us either way. If the event is getting close and you have not heard anything, reply to this email and we will look into it.",
        "",
        "Busayo Disu",
        "President",
        "Africans Society of Strathcona County",
      ].join("\n");
    case "volunteer":
      return [
        "Hi {{first_name}},",
        "",
        "Thanks for signing up to volunteer with ASOSC. Your form came through and we have you on the list.",
        "",
        "Someone from our team will get in touch before the next event to sort out what you would like to help with and when you are free. Usually that is a short email or a quick phone call.",
        "",
        "You mentioned you are interested in {{interests}}, so we will keep that in mind when we are matching people to roles. There is normally room to try something else if it turns out you would rather.",
        "",
        "Busayo Disu",
        "President",
        "Africans Society of Strathcona County",
      ].join("\n");
  }
}

const DEFAULT_SUBJECT: Record<EmailFlowId, string> = {
  donate: "Thank you for supporting ASOSC",
  contact: "We got your message",
  newsletter: "You are subscribed to the ASOSC newsletter",
  vendors: "We received your vendor application",
  volunteer: "Thanks for signing up to volunteer with ASOSC",
};

export function defaultFlowEmailTemplate(flow: EmailFlowId): FlowEmailTemplate {
  const base: FlowEmailTemplate = {
    body: defaultBody(flow),
    subject: DEFAULT_SUBJECT[flow],
    buttonLabel: "",
    buttonUrl: "",
    preheader: "",
  };
  if (flow === "donate") {
    base.etransferBlock = [
      "To complete your donation, send an Interac e-Transfer of {{amount}} to {{etransfer_to}}.",
      "",
      "Please type the word DONATION in the message field when you send it. That message is how we match your transfer to this form, so we would rather you did not leave it blank.",
    ].join("\n");
    base.cardBlock = "We are processing your card payment. Nothing else is needed from you.";
  }
  if (flow === "newsletter") {
    base.unsubscribe = NEWSLETTER_UNSUBSCRIBE_FALLBACK;
  }
  return base;
}

/** Mirrors each flow's own xxRenderBody() so the preview matches exactly what gets sent. */
export function renderFlowEmailBody(
  flow: EmailFlowId,
  template: FlowEmailTemplate,
  sample: FlowEmailSample,
): string {
  switch (flow) {
    case "donate": {
      const isEtransfer = /transfer|interac|etransfer/i.test(sample.method || "");
      const money = moneyFormat(sample.amount, "your donation");
      const instructions = (isEtransfer ? template.etransferBlock : template.cardBlock) || "";
      const filledInstructions = instructions
        .replace(/\{\{amount\}\}/g, money)
        .replace(/\{\{etransfer_to\}\}/g, DONATE_ETRANSFER_TO);
      return template.body
        .replace(/\{\{first_name\}\}/g, sample.firstName || "there")
        .replace(/\{\{name\}\}/g, sample.name || "there")
        .replace(/\{\{amount\}\}/g, money)
        .replace(/\{\{method\}\}/g, sample.method || "your chosen method")
        .replace(/\{\{payment_instructions\}\}/g, filledInstructions)
        .replace(/\n{3,}/g, "\n\n")
        .trim();
    }
    case "contact": {
      const message = (sample.message || "").trim() || "(no message)";
      return template.body
        .replace(/\{\{first_name\}\}/g, sample.firstName || "there")
        .replace(/\{\{name\}\}/g, sample.name || "there")
        .replace(/\{\{message\}\}/g, message)
        .replace(/\n{3,}/g, "\n\n")
        .trim();
    }
    case "newsletter": {
      return template.body
        .replace(/\{\{first_name\}\}/g, sample.firstName || "there")
        .replace(/\{\{name\}\}/g, sample.name || "there")
        .replace(/\n{3,}/g, "\n\n")
        .trim();
    }
    case "vendors": {
      const label = sample.businessName || sample.name || "your application";
      return template.body
        .replace(/\{\{first_name\}\}/g, sample.firstName || "there")
        .replace(/\{\{name\}\}/g, sample.name || "there")
        .replace(/\{\{business_name\}\}/g, label)
        .replace(/\{\{vendor_type\}\}/g, sample.vendorType || "your category")
        .replace(/\n{3,}/g, "\n\n")
        .trim();
    }
    case "volunteer": {
      let text = template.body;
      if (!sample.interests) {
        text = text
          .split("\n")
          .filter((line) => !line.includes("{{interests}}"))
          .join("\n");
      }
      return text
        .replace(/\{\{first_name\}\}/g, sample.firstName || "there")
        .replace(/\{\{name\}\}/g, sample.name || "there")
        .replace(/\{\{interests\}\}/g, (sample.interests || "").replace(/\n/g, ", "))
        .replace(/\n{3,}/g, "\n\n")
        .trim();
    }
  }
}

export const FLOW_PREVIEW_SAMPLE: Record<EmailFlowId, FlowEmailSample> = {
  donate: {
    name: "Sample Donor",
    firstName: "Sample",
    email: "sample@example.com",
    amount: 50,
    method: "Card",
  },
  contact: {
    name: "Sample Visitor",
    firstName: "Sample",
    email: "sample@example.com",
    message: "Hi, I'd like to know more about volunteering opportunities at your next event.",
  },
  newsletter: {
    name: "Sample Subscriber",
    firstName: "Sample",
    email: "sample@example.com",
  },
  vendors: {
    name: "Sample Vendor",
    firstName: "Sample",
    email: "sample@example.com",
    businessName: "Sample Foods Co.",
    vendorType: "Food vendor",
  },
  volunteer: {
    name: "Sample Volunteer",
    firstName: "Sample",
    email: "sample@example.com",
    interests: "event setup, youth programming",
  },
};
