/**
 * Every email ASOSC sends, built from a master-sheet row ({ header: value }).
 *
 * Layout follows the Euphoriel email structure (full-width colour bands, a
 * centred logo + big headline hero with a photo, one bordered action box, a
 * dark footer), in the asosc.ca theme: Avenir Next, ink #2f2b28, orange
 * #f08f3b, cream #f3e8d8 / #faf5eb. Colours are pinned so phones in dark mode
 * don't invert them.
 */

import type { OutgoingEmail } from "@/lib/mailer";
import { membershipCategoryOptions } from "@/lib/join-community-forms";
import { E_TRANSFER_EMAIL, STRIPE_DONATE, STRIPE_MEMBERSHIP } from "@/lib/payment-links";

export type Fields = Record<string, string>;
export type ConfirmationKind = "membership" | "donation" | "volunteer" | "vendor" | "contact" | "newsletter";

const SITE_URL = "https://asosc.ca";
const CLOUDINARY = "https://res.cloudinary.com/daldas2e7/image/upload";
/** PNG (not webp) so Outlook desktop shows it. */
export const EMAIL_LOGO_URL = `${CLOUDINARY}/f_png,w_240/v1782010314/asosc/logo.webp`;
export const HERO = {
  people: `${CLOUDINARY}/f_jpg,q_75,w_1200,h_640,c_fill,g_auto/v1784027716/asosc/gallery-prev/african-festival/afc-2025-8.webp`,
  market: `${CLOUDINARY}/f_jpg,q_75,w_1200,h_640,c_fill,g_auto/v1784027715/asosc/gallery-prev/african-festival/afc-2025-1.webp`,
  wraps: `${CLOUDINARY}/f_jpg,q_75,w_1200,h_640,c_fill,g_auto/v1784027717/asosc/gallery-prev/african-festival/afc-2025-16.webp`,
} as const;
const ICON = (name: string) => `${CLOUDINARY}/f_png,w_48/v1793578736/asosc/email/icon-${name}.webp`;
const INSTAGRAM = "https://www.instagram.com/africansocietystrathconacounty";
const FACEBOOK = "https://www.facebook.com/people/Africans-Society-of-Strathcona-County/61550552301286/";

const C = {
  outer: "#ebe4d8",
  ink: "#2f2b28",
  inkSoft: "#5b544d",
  cream: "#f3e8d8",
  creamLight: "#faf5eb",
  paper: "#fffaf2",
  orange: "#f08f3b",
  orangeDark: "#c66518",
  footer: "#26221f",
  footerText: "#e9dcc6",
  line: "#d9c9b0",
};
const FONT = `'Avenir Next', Avenir, 'Segoe UI', 'Helvetica Neue', Helvetica, Arial, sans-serif`;
const SIGNATURE = ["Busayo Disu", "President", "Africans Society of Strathcona County"];

/** The single bordered box that holds the email's main action. */
type ActionBox = {
  /** Small uppercase label at the top (e.g. "Receipt"). */
  title?: string;
  /** Sentence-case instruction (**text** is bold), with an optional bold second line (e.g. an email address). */
  heading?: { text: string; strong?: string };
  code?: { label: string; value: string };
  lines?: string[];
  /** Smaller, softer text under everything else. */
  note?: string;
  button?: { label: string; href: string };
};

export type EmailContent = {
  to: string;
  subject: string;
  preheader: string;
  banner: string;
  headline: string;
  subhead: string;
  heroUrl: string;
  heroAlt: string;
  intro: string[];
  box?: ActionBox;
  outro?: string[];
  quote?: string;
  /** Footer line explaining why they got this; defaults to the form-signup line. */
  footerNote?: string;
  /** Adds an Unsubscribe link to the footer (bulk emails). */
  unsubscribeUrl?: string;
  /** Hides the photo row (e.g. a composer email with no image). */
  noHero?: boolean;
};

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const nl2br = (s: string) => esc(s).replace(/\n/g, "<br>");

function paragraphs(list: string[] | undefined): string {
  return (list ?? [])
    .map(
      (t) =>
        `<p class="body-text dark-text" align="left" style="margin:0 0 16px;font-family:${FONT};font-size:16px;line-height:1.6;color:${C.ink};text-align:left;">${nl2br(t)}</p>`,
    )
    .join("");
}

function button(b: { label: string; href: string }): string {
  return `<table role="presentation" border="0" cellpadding="0" cellspacing="0" align="center" style="margin:0 auto;">
<tr><td align="center" class="button-bg" style="background-color:${C.ink};border-radius:4px;">
<a href="${esc(b.href)}" target="_blank" class="button-text btn-text" style="display:inline-block;font-family:${FONT};font-size:16px;font-weight:800;color:#ffffff;text-decoration:none;padding:14px 28px;border:1px solid ${C.ink};border-radius:4px;">${esc(b.label)}</a>
</td></tr></table>`;
}

function actionBox(box: ActionBox): string {
  const label = (text: string, gap: number) =>
    `<p class="muted-text" style="margin:0 0 ${gap}px;font-family:${FONT};font-size:11px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:${C.inkSoft};">${esc(text)}</p>`;
  const parts: string[] = [];
  if (box.title) parts.push(label(box.title, 12));
  if (box.heading)
    parts.push(
      `<p class="dark-text" style="margin:0;font-family:${FONT};font-size:17px;line-height:1.45;color:${C.ink};">${esc(box.heading.text).replace(/\*\*(.+?)\*\*/g, '<strong style="font-weight:800;">$1</strong>')}${
        box.heading.strong ? `<br><strong style="font-weight:800;">${esc(box.heading.strong)}</strong>` : ""
      }</p>`,
    );
  if (box.code) {
    const divider = box.heading || box.title
      ? `<table role="presentation" border="0" cellpadding="0" cellspacing="0" align="center" width="64" style="margin:20px auto;"><tr><td style="border-top:1px solid ${C.line};font-size:0;line-height:0;">&nbsp;</td></tr></table>`
      : "";
    parts.push(
      `${divider}${label(box.code.label, 8)}<p class="code-text accent-text" style="margin:0;font-family:${FONT};font-size:40px;font-weight:900;letter-spacing:3px;line-height:1.1;color:${C.orangeDark};">${esc(box.code.value)}</p>`,
    );
  }
  for (const line of box.lines ?? [])
    parts.push(
      `<p class="body-text dark-text" style="margin:${parts.length ? 12 : 0}px 0 0;font-family:${FONT};font-size:15px;line-height:1.55;color:${C.ink};">${nl2br(line)}</p>`,
    );
  if (box.note)
    parts.push(
      `<p class="muted-text" style="margin:${box.code ? 18 : 4}px auto 0;max-width:320px;font-family:${FONT};font-size:13px;line-height:1.5;color:${C.inkSoft};text-wrap:balance;">${nl2br(box.note)}</p>`,
    );
  if (box.button)
    parts.push(`<div style="height:${box.note || box.code ? 18 : 6}px;line-height:0;font-size:0;">&nbsp;</div>${button(box.button)}`);
  return `<tr><td align="center" class="band-bg" style="background-color:${C.cream};padding:4px 28px 28px;">
<table role="presentation" border="0" cellpadding="0" cellspacing="0" align="center" width="100%" style="max-width:480px;">
<tr><td align="center" class="box-bg" style="background-color:${C.paper};border:1px solid ${C.ink};border-radius:4px;padding:28px 24px;">${parts.join("")}</td></tr>
</table></td></tr>`;
}

export function renderEmail(c: EmailContent): OutgoingEmail {
  const quote = c.quote
    ? `<p class="body-text dark-text" style="margin:0 0 16px;font-family:${FONT};font-size:15px;line-height:1.55;color:${C.ink};padding:12px 16px;border-left:3px solid ${C.orange};background-color:${C.creamLight};text-align:left;">${nl2br(c.quote)}</p>`
    : "";

  const html = `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="x-apple-disable-message-reformatting">
<meta name="format-detection" content="telephone=no, date=no, address=no, email=no">
<meta name="color-scheme" content="light only">
<meta name="supported-color-schemes" content="light only">
<title>${esc(c.subject)}</title>
<!--[if mso]><noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript><![endif]-->
<style>
  table, td, div, h1, h2, p { font-family: ${FONT}; }
  body { margin:0; padding:0; width:100%; word-break:break-word; -webkit-font-smoothing:antialiased; background-color:${C.outer}; }
  img { border:0; line-height:100%; outline:none; text-decoration:none; display:block; }
  @media screen and (max-width: 600px) {
    .h1-text { font-size: 9vw !important; }
    .h2-text { font-size: 4.6vw !important; }
    .body-text { font-size: 15px !important; }
    .code-text { font-size: 9vw !important; }
    .btn-text { font-size: 15px !important; padding: 13px 22px !important; }
    .logo-img { width: 96px !important; height: auto !important; }
    .footer-cell { padding-right: 10px !important; }
    .footer-label { font-size: 11px !important; letter-spacing: 0.3px !important; }
  }
  @media (prefers-color-scheme: dark) {
    body, .outer-bg { background-color:${C.outer} !important; background-image:linear-gradient(${C.outer},${C.outer}) !important; }
    .hero-bg { background-color:${C.creamLight} !important; background-image:linear-gradient(to bottom, ${C.cream} 0%, ${C.creamLight} 100%) !important; }
    .band-bg { background-color:${C.cream} !important; }
    .box-bg { background-color:${C.paper} !important; border-color:${C.ink} !important; }
    .dark-text { color:${C.ink} !important; -webkit-text-fill-color:${C.ink} !important; }
    .accent-text { color:${C.orangeDark} !important; -webkit-text-fill-color:${C.orangeDark} !important; }
    .muted-text { color:${C.inkSoft} !important; -webkit-text-fill-color:${C.inkSoft} !important; }
    .light-text { color:${C.footerText} !important; -webkit-text-fill-color:${C.footerText} !important; }
    .top-bg { background-color:${C.ink} !important; }
    .footer-bg { background-color:${C.footer} !important; }
    .button-bg { background-color:${C.ink} !important; }
    .button-text { color:#ffffff !important; -webkit-text-fill-color:#ffffff !important; }
  }
  u + #body a { color: inherit; }
</style>
</head>
<body id="body" class="outer-bg" style="margin:0;padding:0;background-color:${C.outer};">
<div style="display:none;font-size:1px;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;color:${C.outer};">${esc(c.preheader)}${"&nbsp;&zwnj;".repeat(60)}</div>
<div role="article" aria-roledescription="email" lang="en" style="text-size-adjust:100%;-webkit-text-size-adjust:100%;">
<table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0" class="outer-bg" style="background-color:${C.outer};">
<tr><td align="center" style="padding:0;">
<table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0" align="center" style="max-width:600px;width:100%;margin:0 auto;background-color:${C.cream};">

<tr><td align="center" class="top-bg" style="background-color:${C.ink};padding:12px 20px;">
<p class="light-text" style="margin:0;font-family:${FONT};font-size:12px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:${C.cream};">${esc(c.banner)}</p>
</td></tr>

<tr><td align="center" class="hero-bg" style="background-color:${C.creamLight};background-image:linear-gradient(to bottom, ${C.cream} 0%, ${C.creamLight} 100%);padding:0;">
<table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0">
<tr><td align="center" style="padding:32px 0 26px;">
<a href="${SITE_URL}" target="_blank" style="text-decoration:none;"><img src="${EMAIL_LOGO_URL}" width="120" alt="ASOSC" class="logo-img" style="display:block;width:120px;max-width:120px;height:auto;border-radius:50%;"></a>
</td></tr>
<tr><td align="center" style="padding:0 24px 26px;">
<h1 class="dark-text h1-text" style="margin:0 0 12px;font-family:${FONT};font-size:48px;font-weight:900;line-height:1.05;letter-spacing:-0.5px;color:${C.ink};">${esc(c.headline)}</h1>
<h2 class="dark-text h2-text" style="margin:0;font-family:${FONT};font-size:20px;font-weight:400;line-height:1.35;color:${C.ink};">${esc(c.subhead)}</h2>
</td></tr>
${c.noHero || !c.heroUrl ? "" : `<tr><td align="center" style="padding:0;font-size:0;">
<img src="${esc(c.heroUrl)}" width="600" alt="${esc(c.heroAlt)}" style="display:block;width:100%;max-width:600px;height:auto;">
</td></tr>`}
</table>
</td></tr>

<tr><td align="center" class="band-bg" style="background-color:${C.cream};padding:32px 28px 12px;">
<table role="presentation" border="0" cellpadding="0" cellspacing="0" align="center" width="100%" style="max-width:480px;"><tr><td align="left" style="text-align:left;">
${paragraphs(c.intro)}${quote}
</td></tr></table>
</td></tr>

${c.box ? actionBox(c.box) : ""}

<tr><td align="center" class="band-bg" style="background-color:${C.cream};padding:${c.box ? 8 : 8}px 28px 34px;">
<table role="presentation" border="0" cellpadding="0" cellspacing="0" align="center" width="100%" style="max-width:480px;"><tr><td align="left" style="text-align:left;">
${paragraphs(c.outro)}
<p class="dark-text" align="left" style="margin:${c.outro?.length ? 24 : 0}px 0 0;font-family:${FONT};font-size:16px;line-height:1.5;color:${C.ink};text-align:left;"><strong>${esc(SIGNATURE[0])}</strong><br>${SIGNATURE.slice(1).map(esc).join("<br>")}</p>
</td></tr></table>
</td></tr>

<tr><td align="center" class="footer-bg" style="background-color:${C.footer};padding:30px 28px 28px;">
<table role="presentation" border="0" cellpadding="0" cellspacing="0" align="center" width="100%" style="max-width:480px;"><tr><td align="left" style="text-align:left;">
<table role="presentation" border="0" cellpadding="0" cellspacing="0" align="left" style="margin:0 0 20px;"><tr>
${[
  { href: INSTAGRAM, icon: "instagram", label: "Instagram" },
  { href: FACEBOOK, icon: "facebook", label: "Facebook" },
  { href: SITE_URL, icon: "web", label: "asosc.ca" },
]
  .map(
    (l, i) => `<td align="left" valign="middle" class="footer-cell" style="padding:0 ${i < 2 ? 20 : 0}px 0 0;"><a href="${l.href}" target="_blank" style="text-decoration:none;color:${C.footerText};"><table role="presentation" border="0" cellpadding="0" cellspacing="0"><tr><td valign="middle" style="padding-right:7px;"><img src="${ICON(l.icon)}" width="18" height="18" alt="" style="display:block;width:18px;height:18px;"></td><td valign="middle" class="light-text footer-label" style="font-family:${FONT};font-size:12px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:${C.footerText};white-space:nowrap;">${l.label}</td></tr></table></a></td>`,
  )
  .join("")}
</tr></table>
<div style="clear:both;height:0;line-height:0;font-size:0;">&nbsp;</div>
<p class="light-text" align="left" style="margin:0 0 12px;font-family:${FONT};font-size:12px;line-height:1.6;color:${C.footerText};text-align:left;">
${c.footerNote ? esc(c.footerNote) : `You're getting this because you filled in a form on <a href="${SITE_URL}" style="color:${C.footerText};text-decoration:underline;">asosc.ca</a>.`}${
  c.unsubscribeUrl ? `<br><a href="${esc(c.unsubscribeUrl)}" style="color:${C.footerText};text-decoration:underline;">Unsubscribe</a>` : ""
}
</p>
<p class="light-text" align="left" style="margin:0;font-family:${FONT};font-size:12px;line-height:1.6;color:${C.footerText};text-align:left;opacity:0.8;">
Strathcona County, Alberta
</p>
</td></tr></table>
</td></tr>

</table>
</td></tr></table>
</div>
</body>
</html>`;

  const box = c.box
    ? [
        c.box.title,
        c.box.heading ? [c.box.heading.text.replace(/\*\*/g, ""), c.box.heading.strong].filter(Boolean).join(" ") : undefined,
        c.box.code ? `${c.box.code.label}: ${c.box.code.value}` : undefined,
        ...(c.box.lines ?? []),
        c.box.note,
        c.box.button ? `${c.box.button.label}: ${c.box.button.href}` : undefined,
      ].filter(Boolean)
    : [];
  const text = [
    `${c.headline.toUpperCase()}`,
    c.subhead,
    ...c.intro,
    ...(c.quote ? [c.quote.split("\n").map((l) => `> ${l}`).join("\n")] : []),
    ...box,
    ...(c.outro ?? []),
    SIGNATURE.join("\n"),
    `asosc.ca · Instagram: ${INSTAGRAM} · Strathcona County, Alberta`,
    ...(c.unsubscribeUrl ? [`Unsubscribe: ${c.unsubscribeUrl}`] : []),
  ].join("\n\n");

  return { to: c.to, subject: c.subject, html, text };
}


// ---------------------------------------------------------------- editable copy

/** The wording staff can edit for an email. Paragraphs are separated by a blank line; {placeholders} are filled per recipient. */
export type EditableCopy = {
  subject: string;
  preheader: string;
  banner: string;
  headline: string;
  subhead: string;
  intro: string;
  outro: string;
  /** Photo under the headline; empty uses the default for that email. */
  heroUrl?: string;
};

export type AutoEmailId =
  | "membership"
  | "donation"
  | "volunteer"
  | "vendor"
  | "contact"
  | "newsletter"
  | "paid-membership"
  | "paid-donation"
  | "paid-vendor"
  | "invoice"
  | "invoice-due"
  | "vendor-approved"
  | "reminder-membership"
  | "reminder-donation"
  | "reminder-vendor";

export const AUTO_EMAILS: Array<{
  id: AutoEmailId;
  label: string;
  when: string;
  placeholders: string[];
  defaultHero: string;
}> = [
  { id: "membership", label: "Membership signup", when: "Right after the membership form is submitted.", placeholders: ["first_name", "category", "payment_code"], defaultHero: HERO.people },
  { id: "donation", label: "Donation signup", when: "Right after the donate form is submitted.", placeholders: ["first_name", "amount", "payment_code"], defaultHero: HERO.wraps },
  { id: "volunteer", label: "Volunteer signup", when: "Right after the volunteer form is submitted.", placeholders: ["first_name"], defaultHero: HERO.people },
  { id: "vendor", label: "Vendor application", when: "Right after a vendor application is submitted.", placeholders: ["first_name", "business"], defaultHero: HERO.market },
  { id: "contact", label: "Contact message", when: "Right after the contact form is submitted.", placeholders: ["first_name"], defaultHero: HERO.people },
  { id: "newsletter", label: "Newsletter signup", when: "Right after someone subscribes.", placeholders: ["first_name"], defaultHero: HERO.people },
  { id: "paid-membership", label: "Membership paid", when: "When an e-Transfer is matched to their membership.", placeholders: ["first_name", "category", "amount"], defaultHero: HERO.people },
  { id: "paid-donation", label: "Donation paid", when: "When an e-Transfer is matched to their donation.", placeholders: ["first_name", "amount"], defaultHero: HERO.wraps },
  { id: "paid-vendor", label: "Vendor fee paid", when: "When an e-Transfer is matched to their vendor application.", placeholders: ["first_name", "amount"], defaultHero: HERO.market },
  { id: "invoice", label: "Receipt", when: "When you create a receipt for a payment marked \"Something else\" (the PDF is attached).", placeholders: ["first_name", "invoice_number", "amount"], defaultHero: HERO.people },
  { id: "invoice-due", label: "Invoice to pay", when: "When you send someone an invoice from the Invoices page (the PDF is attached).", placeholders: ["first_name", "invoice_number", "amount", "due_date"], defaultHero: HERO.people },
  { id: "vendor-approved", label: "Vendor approved", when: "When staff set a vendor's Status to Approved (includes their fee and payment code).", placeholders: ["first_name", "business", "amount", "payment_code"], defaultHero: HERO.market },
  { id: "reminder-membership", label: "Membership reminder", when: "Weekly while a membership is unpaid (3 per round, 30-day pause, up to 3 rounds).", placeholders: ["first_name", "category", "amount", "payment_code"], defaultHero: HERO.people },
  { id: "reminder-donation", label: "Donation reminder", when: "Weekly while a donation is unpaid (3 per round, 30-day pause, up to 3 rounds).", placeholders: ["first_name", "amount", "payment_code"], defaultHero: HERO.wraps },
  { id: "reminder-vendor", label: "Vendor fee reminder", when: "Weekly while an approved vendor's fee is unpaid (3 per round, 30-day pause, up to 3 rounds).", placeholders: ["first_name", "business", "amount", "payment_code"], defaultHero: HERO.market },
];

export function isAutoEmailId(value: unknown): value is AutoEmailId {
  return typeof value === "string" && AUTO_EMAILS.some((e) => e.id === value);
}

export const DEFAULT_COPY: Record<AutoEmailId, EditableCopy> = {
  membership: {
    subject: "Your ASOSC membership: one step left",
    preheader: "Your payment code is {payment_code}.",
    banner: "ASOSC Membership",
    headline: "One step left",
    subhead: "Pay your membership to make it official",
    intro: "Hi {first_name},\n\nThanks for signing up for an ASOSC membership. We have your details down for the {category}.",
    outro:
      "Once your payment comes through we will mark your membership active and send you your membership card.\n\nIf anything here looks wrong, reply to this email and we will fix it.",
  },
  donation: {
    subject: "Thank you for supporting ASOSC",
    preheader: "Your payment code is {payment_code}.",
    banner: "Donation",
    headline: "Thank you",
    subhead: "Here's how to complete your {amount} gift",
    intro: "Hi {first_name},",
    outro:
      "Your donation goes straight into the work: cultural celebrations, youth programming, wellness sessions, and community outreach across Strathcona County.\n\nIf you need anything for your records, reply to this email and we will sort it out.",
  },
  volunteer: {
    subject: "Thanks for signing up to volunteer with ASOSC",
    preheader: "Your form came through and we have you on the list.",
    banner: "Volunteer",
    headline: "You're on the list",
    subhead: "Thanks for volunteering with ASOSC",
    intro:
      "Hi {first_name},\n\nSomeone from our team will get in touch before the next event to sort out what you would like to help with and when you are free. Usually that is a short email or a quick phone call.",
    outro: "",
  },
  vendor: {
    subject: "We received your vendor application",
    preheader: "This confirms we have your form. It is not an approval yet.",
    banner: "Vendor application",
    headline: "Application received",
    subhead: "Thanks for applying with {business}",
    intro: "Hi {first_name},",
    outro:
      "You will hear from us either way. If the event is getting close and you have not heard anything, reply to this email and we will look into it.",
  },
  contact: {
    subject: "We got your message",
    preheader: "Someone will get back to you within a few business days.",
    banner: "Contact",
    headline: "Message received",
    subhead: "We'll reply within a few business days",
    intro: "Hi {first_name},",
    outro:
      "If it is time sensitive, like an event happening this week, reply to this email and say so and we will move it up the queue.",
  },
  newsletter: {
    subject: "You are subscribed to the ASOSC newsletter",
    preheader: "Thanks for subscribing.",
    banner: "Newsletter",
    headline: "You're subscribed",
    subhead: "Thanks for joining the ASOSC newsletter",
    intro:
      "Hi {first_name},\n\nWe send an update roughly once a month, and a bit more often in the weeks before something big like the African Festival. It covers what is coming up, how to get involved, and what has been happening around Strathcona County.",
    outro:
      "That is the only thing we will use your email address for, and we do not share it with anyone. If you change your mind, reply to this message and we will take you off the list.",
  },
  "paid-membership": {
    subject: "Payment received, your ASOSC membership is active",
    preheader: "We received your {amount} payment. Welcome to ASOSC.",
    banner: "ASOSC Membership",
    headline: "Welcome to ASOSC",
    subhead: "Your membership is active",
    intro: "Hi {first_name},\n\nThanks for your payment. You're now an official ASOSC member.",
    outro: "Keep this email for your records.",
  },
  "paid-donation": {
    subject: "Thank you, we received your donation",
    preheader: "Your {amount} donation came through.",
    banner: "Donation",
    headline: "Gift received",
    subhead: "Thank you for supporting our community",
    intro: "Hi {first_name},",
    outro: "Keep this email for your records. If you need anything else, just reply.",
  },
  "paid-vendor": {
    subject: "We received your vendor payment",
    preheader: "Your {amount} payment came through.",
    banner: "Vendor",
    headline: "Payment received",
    subhead: "Thank you, see you at the event",
    intro: "Hi {first_name},",
    outro: "Keep this email for your records. We will be in touch with booth details closer to the event.",
  },
  invoice: {
    subject: "Your ASOSC receipt {invoice_number}",
    preheader: "Thanks for your payment. Your receipt is attached.",
    banner: "Receipt",
    headline: "Thank you",
    subhead: "Your receipt is attached",
    intro: "Hi {first_name},\n\nThanks for your payment. Your receipt is attached to this email for your records.",
    outro: "If anything on the receipt needs changing, like a business name or address, just reply and we will send a new one.",
  },
  "invoice-due": {
    subject: "Invoice {invoice_number} from ASOSC",
    preheader: "{amount} by Interac e-Transfer. The invoice is attached.",
    banner: "Invoice",
    headline: "Your invoice",
    subhead: "From the Africans Society of Strathcona County",
    intro: "Hi {first_name},\n\nHere is your invoice from ASOSC. The PDF is attached to this email.",
    outro: "Questions about this invoice? Just reply to this email.",
  },
  "vendor-approved": {
    subject: "You're approved to vend with ASOSC",
    preheader: "Pay your {amount} vendor fee to lock in your spot.",
    banner: "Vendor",
    headline: "You're approved",
    subhead: "Welcome aboard, {business}",
    intro: "Hi {first_name},\n\nGood news: your vendor application has been approved. To lock in your spot, please pay your vendor fee.",
    outro: "Once your payment comes through we will send a receipt, then booth details closer to the event.\n\nQuestions about your booth? Just reply to this email.",
  },
  "reminder-membership": {
    subject: "Reminder: finish your ASOSC membership",
    preheader: "Your payment code is {payment_code}.",
    banner: "ASOSC Membership",
    headline: "Just a reminder",
    subhead: "Your membership is waiting on payment",
    intro: "Hi {first_name},\n\nWe haven't received the payment for your {category} yet. Here is everything you need to finish it.",
    outro: "Already paid? Reply to this email and we will sort it out. If you have changed your mind, reply and we will stop these reminders.",
  },
  "reminder-donation": {
    subject: "Reminder: your {amount} gift to ASOSC",
    preheader: "Your payment code is {payment_code}.",
    banner: "Donation",
    headline: "Still want to give?",
    subhead: "Your {amount} donation hasn't come through yet",
    intro: "Hi {first_name},\n\nThank you again for choosing to support ASOSC. We haven't received your donation yet, so here are the details in case you still want to send it.",
    outro: "Already sent it? Reply to this email and we will sort it out. If you have changed your mind, reply and we will stop these reminders.",
  },
  "reminder-vendor": {
    subject: "Reminder: pay your ASOSC vendor fee",
    preheader: "Your payment code is {payment_code}.",
    banner: "Vendor",
    headline: "Your spot is waiting",
    subhead: "Pay your vendor fee to confirm your booth",
    intro: "Hi {first_name},\n\nWe haven't received the vendor fee for {business} yet. Your spot isn't confirmed until it comes through.",
    outro: "Already paid? Reply to this email and we will sort it out. If you can no longer make it, reply and we will free up your spot.",
  },
};

export type CopyOverrides = Partial<Record<AutoEmailId, Partial<EditableCopy>>>;

/** Fills {placeholders}; unknown ones are left as-is so a typo is visible in the preview. */
export function fillPlaceholders(text: string, vars: Record<string, string>): string {
  return text
    .replace(/\{([a-z_]+)\}/g, (m, key: string) => (key in vars ? vars[key] : m))
    .replace(/[ \t]{2,}/g, " ")
    .replace(/ ([.,!?])/g, "$1");
}

export function splitParagraphs(text: string): string[] {
  return text
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);
}

export function copyFor(id: AutoEmailId, overrides?: CopyOverrides): EditableCopy {
  const base = DEFAULT_COPY[id];
  const o = overrides?.[id] ?? {};
  const pick = (k: keyof EditableCopy) => {
    const v = o[k];
    return typeof v === "string" && v.trim() !== "" ? v : base[k];
  };
  return {
    subject: pick("subject")!,
    preheader: pick("preheader")!,
    banner: pick("banner")!,
    headline: pick("headline")!,
    subhead: pick("subhead")!,
    // Paragraph fields may be intentionally cleared, so only fall back when the key is absent.
    intro: typeof o.intro === "string" ? o.intro : base.intro,
    outro: typeof o.outro === "string" ? o.outro : base.outro,
    heroUrl: (typeof o.heroUrl === "string" && o.heroUrl) || "",
  };
}

/** Email-safe (JPEG, cropped 1200×640) version of a Cloudinary image for the hero row. */
export function emailHeroUrl(url: string): string {
  if (!/^https:\/\/res\.cloudinary\.com\/[^/]+\/image\/upload\//.test(url)) return url;
  if (/\/upload\/f_jpg/.test(url)) return url;
  return url.replace("/image/upload/", "/image/upload/f_jpg,q_75,w_1200,h_640,c_fill,g_auto/");
}

function buildFromCopy(
  id: AutoEmailId,
  to: string,
  vars: Record<string, string>,
  overrides: CopyOverrides | undefined,
  extra: Pick<EmailContent, "box" | "quote"> = {},
): OutgoingEmail {
  const copy = copyFor(id, overrides);
  const meta = AUTO_EMAILS.find((e) => e.id === id)!;
  const f = (t: string) => fillPlaceholders(t, vars);
  return renderEmail({
    to,
    subject: f(copy.subject),
    preheader: f(copy.preheader),
    banner: f(copy.banner),
    headline: f(copy.headline),
    subhead: f(copy.subhead),
    heroUrl: copy.heroUrl ? emailHeroUrl(copy.heroUrl) : meta.defaultHero,
    heroAlt: "ASOSC community event",
    intro: splitParagraphs(f(copy.intro)),
    outro: splitParagraphs(f(copy.outro)),
    ...extra,
  });
}

// ---------------------------------------------------------------- helpers

function firstName(f: Fields): string {
  return (f["Full Name"] ?? "").trim().split(/\s+/)[0] || "there";
}

function money(value: string): string {
  const n = Number(String(value ?? "").replace(/[^0-9.]/g, ""));
  if (!Number.isFinite(n) || n <= 0) return "";
  return `$${Number.isInteger(n) ? n : n.toFixed(2)}`;
}

function membershipCategory(f: Fields) {
  const label = (f["Membership Category"] ?? "").toLowerCase();
  return membershipCategoryOptions.find((o) => label.startsWith(o.title.toLowerCase()));
}

/** e-Transfer instructions with the payment code, or a card button, depending on how they chose to pay. */
function paymentBox(opts: { method: string; amount: string; code: string; cardUrl: string; what: string }): ActionBox {
  const amount = opts.amount || "the amount";
  if (/card/i.test(opts.method)) {
    return { heading: { text: `Pay **${amount}** by card` }, button: { label: "Pay by card", href: opts.cardUrl } };
  }
  const box: ActionBox = {
    heading: { text: `Send **${amount}** by Interac e-Transfer to`, strong: E_TRANSFER_EMAIL },
    code: { label: "Type this in the message box", value: opts.code },
    note: `This code is how we match your transfer to your ${opts.what}, so please don't leave the message blank.`,
  };
  if (!/transfer/i.test(opts.method)) {
    box.note += " Prefer card? Use the button below.";
    box.button = { label: "Pay by card", href: opts.cardUrl };
  }
  return box;
}

// ---------------------------------------------------------------- automatic emails

/** Sent right after someone submits a website form. */
export function confirmationEmail(kind: ConfirmationKind, f: Fields, overrides?: CopyOverrides): OutgoingEmail {
  const to = f["Email"] ?? "";
  const base = { first_name: firstName(f) };

  switch (kind) {
    case "membership": {
      const cat = membershipCategory(f);
      const stripe = cat ? STRIPE_MEMBERSHIP[cat.value as keyof typeof STRIPE_MEMBERSHIP] : undefined;
      return buildFromCopy(
        "membership",
        to,
        { ...base, category: cat?.title ?? (f["Membership Category"] || "membership"), payment_code: f["Payment Code"] ?? "" },
        overrides,
        {
          box: paymentBox({
            method: f["Payment Method"] ?? "",
            amount: money(cat?.price ?? ""),
            code: f["Payment Code"] ?? "",
            cardUrl: stripe ?? `${SITE_URL}/join?action=membership`,
            what: "membership",
          }),
        },
      );
    }
    case "donation": {
      const amount = money(f["Amount"] ?? "");
      return buildFromCopy("donation", to, { ...base, amount, payment_code: f["Payment Code"] ?? "" }, overrides, {
        box: paymentBox({
          method: f["Payment Method"] ?? "",
          amount,
          code: f["Payment Code"] ?? "",
          cardUrl: STRIPE_DONATE,
          what: "donation",
        }),
      });
    }
    case "volunteer": {
      const interests = (f["Interests"] ?? "").trim();
      return buildFromCopy("volunteer", to, base, overrides, {
        box: interests
          ? {
              title: "You told us you're interested in",
              heading: { text: `**${interests}**` },
              lines: ["We'll keep that in mind when matching people to roles. There's normally room to try something else if you'd rather."],
            }
          : undefined,
      });
    }
    case "vendor":
      return buildFromCopy("vendor", to, { ...base, business: (f["Business Name"] ?? "").trim() || "your business" }, overrides, {
        box: {
          title: "Where this stands",
          lines: [
            "This confirms we received your form. It is not an approval yet.",
            "We go through every application and contact selected vendors about booth details, timing, and what to bring on the day.",
          ],
        },
      });
    case "contact": {
      const message = (f["Message"] ?? "").trim();
      const email = buildFromCopy("contact", to, base, overrides, {
        quote: message ? message.slice(0, 2000) : undefined,
      });
      return email;
    }
    case "newsletter":
      return buildFromCopy("newsletter", to, base, overrides);
  }
}

/** Sent when an e-Transfer is matched to a membership, donation or vendor signup. */
export function paymentReceivedEmail(
  type: "Membership" | "Donation" | "Vendor",
  f: Fields,
  payment: { amount: string; date: string },
  overrides?: CopyOverrides,
): OutgoingEmail {
  const to = f["Email"] ?? "";
  const amount = money(payment.amount);
  const vars = { first_name: firstName(f), amount };
  const receipt = (what: string): ActionBox => ({
    title: "Receipt",
    lines: [
      [`${what}${amount ? `: ${amount}` : ""}`, payment.date ? `Received ${payment.date}` : "", "Paid by Interac e-Transfer"]
        .filter(Boolean)
        .join("\n"),
    ],
  });

  if (type === "Membership") {
    const cat = membershipCategory(f);
    const card = (f["Membership Card URL"] ?? "").trim();
    const box = receipt(cat?.title ?? "ASOSC membership");
    if (card) box.button = { label: "View your membership card", href: card };
    return buildFromCopy("paid-membership", to, { ...vars, category: cat?.title ?? "membership" }, overrides, { box });
  }
  if (type === "Donation") return buildFromCopy("paid-donation", to, vars, overrides, { box: receipt("Donation to ASOSC") });
  return buildFromCopy("paid-vendor", to, vars, overrides, { box: receipt("Vendor fee") });
}

// ---------------------------------------------------------------- composer

export type ComposerAttachment = { name: string; url: string; size: number; type: string };

/** A one-off email written in the dashboard composer. */
export type ComposerContent = {
  subject: string;
  preheader: string;
  banner: string;
  headline: string;
  subhead: string;
  heroUrl: string;
  body: string;
  button?: { label: string; url: string };
  attachments?: ComposerAttachment[];
};

export const BLANK_COMPOSER: ComposerContent = {
  subject: "",
  preheader: "",
  banner: "ASOSC",
  headline: "",
  subhead: "",
  heroUrl: "",
  body: "Hi {first_name},\n\n",
  button: { label: "", url: "" },
  attachments: [],
};

export function composerEmail(
  c: ComposerContent,
  recipient: { email: string; name: string },
  unsubscribeUrl?: string,
): OutgoingEmail {
  const vars = { first_name: (recipient.name || "").trim().split(/\s+/)[0] || "there" };
  const f = (t: string) => fillPlaceholders(t ?? "", vars);
  const button = c.button?.label?.trim() && c.button?.url?.trim() ? c.button : undefined;
  return renderEmail({
    to: recipient.email,
    subject: f(c.subject) || "(no subject)",
    preheader: f(c.preheader || c.subhead || ""),
    banner: f(c.banner || "ASOSC"),
    headline: f(c.headline),
    subhead: f(c.subhead),
    heroUrl: c.heroUrl ? emailHeroUrl(c.heroUrl) : "",
    heroAlt: c.headline || "ASOSC event",
    noHero: !c.heroUrl,
    intro: splitParagraphs(f(c.body)),
    box: button ? { button: { label: f(button.label), href: button.url.trim() } } : undefined,
    footerNote: "You're getting this because you're on the ASOSC mailing list.",
    unsubscribeUrl,
  });
}

// ---------------------------------------------------------------- invoice

export type InvoiceSummary = {
  number: string;
  payerName: string;
  payerEmail: string;
  description: string;
  amount: string;
  paidOn?: string;
};

/** The email that carries a paid PDF receipt (attached by the caller). Auto email id stays "invoice". */
export function invoiceEmail(inv: InvoiceSummary, overrides?: CopyOverrides): OutgoingEmail {
  const amount = money(inv.amount);
  const paid = inv.paidOn ? new Date(inv.paidOn) : null;
  const paidLabel = paid && !Number.isNaN(paid.getTime()) ? paid.toLocaleDateString("en-CA", { dateStyle: "long" }) : "";
  return buildFromCopy(
    "invoice",
    inv.payerEmail,
    {
      first_name: (inv.payerName || "").trim().split(/\s+/)[0] || "there",
      invoice_number: inv.number,
      amount,
    },
    overrides,
    {
      box: {
        title: `Receipt ${inv.number}`,
        lines: [
          [inv.description || "Services", `${amount}${paidLabel ? ` · paid ${paidLabel}` : " · paid"}`].join("\n"),
        ],
        note: "Paid in full. The PDF receipt is attached to this email.",
      },
    },
  );
}

/** An invoice that still needs paying: e-Transfer instructions with the invoice number as the message. */
export function invoiceDueEmail(inv: InvoiceSummary & { dueDate?: string }, overrides?: CopyOverrides): OutgoingEmail {
  const amount = money(inv.amount);
  const due = inv.dueDate ? new Date(`${inv.dueDate}T12:00:00`) : null;
  const dueLabel = due && !Number.isNaN(due.getTime()) ? due.toLocaleDateString("en-CA", { dateStyle: "long" }) : "";
  return buildFromCopy(
    "invoice-due",
    inv.payerEmail,
    {
      first_name: (inv.payerName || "").trim().split(/\s+/)[0] || "there",
      invoice_number: inv.number,
      amount,
      due_date: dueLabel,
    },
    overrides,
    {
      box: {
        heading: { text: `Send **${amount}** by Interac e-Transfer to`, strong: E_TRANSFER_EMAIL },
        code: { label: "Type this in the message box", value: inv.number },
        note: `${inv.description || "Services"}.${dueLabel ? ` Please pay by ${dueLabel}.` : ""} The invoice number is how we match your payment.`,
      },
    },
  );
}

export const SAMPLE_INVOICE: InvoiceSummary = {
  number: "INV-2026-0001",
  payerName: "Black Spice Services",
  payerEmail: "ada@example.com",
  description: "Catering for Black History Month celebration",
  amount: "150.00",
  paidOn: "2026-10-13T16:21:04Z",
};

// ---------------------------------------------------------------- vendor approval + payment reminders

export type ReminderKind = "membership" | "donation" | "vendor";

function vendorFee(f: Fields): string {
  return money(f["Fee"] ?? "");
}

/** Sent once when staff set a vendor's Status to Approved. */
export function vendorApprovedEmail(f: Fields, overrides?: CopyOverrides): OutgoingEmail {
  const amount = vendorFee(f);
  const code = f["Payment Code"] ?? "";
  return buildFromCopy(
    "vendor-approved",
    f["Email"] ?? "",
    { first_name: firstName(f), business: (f["Business Name"] ?? "").trim() || "your business", amount, payment_code: code },
    overrides,
    {
      box:
        amount && code
          ? paymentBox({ method: "e-Transfer", amount, code, cardUrl: "", what: "vendor booth" })
          : { title: "Next steps", lines: ["We will be in touch with booth details closer to the event."] },
    },
  );
}

/** Weekly reminder while a membership, donation or approved vendor fee is unpaid. */
export function reminderEmail(kind: ReminderKind, f: Fields, overrides?: CopyOverrides): OutgoingEmail {
  const to = f["Email"] ?? "";
  const code = f["Payment Code"] ?? "";
  const vars = { first_name: firstName(f), payment_code: code };
  if (kind === "membership") {
    const cat = membershipCategory(f);
    const stripe = cat ? STRIPE_MEMBERSHIP[cat.value as keyof typeof STRIPE_MEMBERSHIP] : undefined;
    const amount = money(cat?.price ?? "");
    return buildFromCopy("reminder-membership", to, { ...vars, amount, category: cat?.title ?? "membership" }, overrides, {
      box: paymentBox({ method: f["Payment Method"] ?? "", amount, code, cardUrl: stripe ?? `${SITE_URL}/join?action=membership`, what: "membership" }),
    });
  }
  if (kind === "donation") {
    const amount = money(f["Amount"] ?? "");
    return buildFromCopy("reminder-donation", to, { ...vars, amount }, overrides, {
      box: paymentBox({ method: f["Payment Method"] ?? "", amount, code, cardUrl: STRIPE_DONATE, what: "donation" }),
    });
  }
  const amount = vendorFee(f);
  return buildFromCopy(
    "reminder-vendor",
    to,
    { ...vars, amount, business: (f["Business Name"] ?? "").trim() || "your business" },
    overrides,
    { box: paymentBox({ method: "e-Transfer", amount, code, cardUrl: "", what: "vendor booth" }) },
  );
}

const SAMPLE_VENDOR: Fields = {
  "Full Name": "Ada Okafor",
  Email: "ada@example.com",
  "Business Name": "Ada's Kitchen",
  Fee: "150",
  "Payment Code": "V-6120",
};

/** Sample rows for dashboard previews. */
export const SAMPLE_FIELDS: Record<ConfirmationKind, Fields> = {
  membership: {
    "Full Name": "Ada Okafor",
    Email: "ada@example.com",
    "Membership Category": "Family Membership ($30CAD)",
    "Payment Method": "e-Transfer",
    "Payment Code": "M-4821",
    "Membership Card URL": "https://res.cloudinary.com/daldas2e7/image/upload/asosc/logo.webp",
  },
  donation: { "Full Name": "Ada Okafor", Email: "ada@example.com", Amount: "50", "Payment Method": "e-Transfer", "Payment Code": "D-3307" },
  volunteer: { "Full Name": "Ada Okafor", Email: "ada@example.com", Interests: "Fundraising, Youth Mentorship" },
  vendor: { "Full Name": "Ada Okafor", Email: "ada@example.com", "Business Name": "Ada's Kitchen" },
  contact: { "Full Name": "Ada Okafor", Email: "ada@example.com", Message: "Hi! Do you have events coming up in December?" },
  newsletter: { "Full Name": "Ada Okafor", Email: "ada@example.com" },
};

/** Renders any automatic email with sample data — dashboard previews. */
export function sampleAutoEmail(id: AutoEmailId, overrides?: CopyOverrides): OutgoingEmail {
  const date = new Date().toLocaleDateString("en-CA", { timeZone: "America/Edmonton", dateStyle: "long" });
  if (id === "paid-membership") return paymentReceivedEmail("Membership", SAMPLE_FIELDS.membership, { amount: "30.00", date }, overrides);
  if (id === "paid-donation") return paymentReceivedEmail("Donation", SAMPLE_FIELDS.donation, { amount: "50.00", date }, overrides);
  if (id === "paid-vendor") return paymentReceivedEmail("Vendor", SAMPLE_FIELDS.vendor, { amount: "150.00", date }, overrides);
  if (id === "invoice") return invoiceEmail(SAMPLE_INVOICE, overrides);
  if (id === "invoice-due") return invoiceDueEmail({ ...SAMPLE_INVOICE, paidOn: undefined, dueDate: "2026-12-01" }, overrides);
  if (id === "vendor-approved") return vendorApprovedEmail(SAMPLE_VENDOR, overrides);
  if (id === "reminder-membership") return reminderEmail("membership", SAMPLE_FIELDS.membership, overrides);
  if (id === "reminder-donation") return reminderEmail("donation", SAMPLE_FIELDS.donation, overrides);
  if (id === "reminder-vendor") return reminderEmail("vendor", SAMPLE_VENDOR, overrides);
  return confirmationEmail(id, SAMPLE_FIELDS[id], overrides);
}
