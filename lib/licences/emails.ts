import { HERO, renderEmail } from "@/lib/emails";
import type { OutgoingEmail } from "@/lib/mailer";

/**
 * The one email a licence holder gets from the site: a link that signs them
 * in to the library. Sent after a purchase (welcome) and whenever they ask
 * for a fresh link (sign-in).
 */
export function libraryLinkEmail(opts: {
  to: string;
  name?: string;
  link: string;
  kind: "welcome" | "sign-in";
  tierName?: string;
}): OutgoingEmail {
  const first = (opts.name ?? "").trim().split(/\s+/)[0] || "there";
  const welcome = opts.kind === "welcome";
  return renderEmail({
    to: opts.to,
    subject: welcome ? "Your ASOSC library is ready" : "Your sign-in link for the ASOSC library",
    preheader: welcome ? "Your access to the Our Story Our Voice documentaries is ready." : "This link signs you in for the next 30 minutes.",
    banner: "Educational Resource Library",
    headline: welcome ? "Welcome to the library" : "Sign in to the library",
    subhead: welcome ? "Your licence is active" : "Use the button below to sign in",
    heroUrl: HERO.people,
    heroAlt: "ASOSC community event",
    intro: welcome
      ? [
          `Hi ${first},`,
          `Thank you for licensing the ASOSC Educational Resource Library${opts.tierName ? ` (${opts.tierName})` : ""}. Your licence opens all the Our Story Our Voice documentaries.`,
        ]
      : [`Hi ${first},`, "Here is your link to sign in to the ASOSC Educational Resource Library."],
    box: {
      heading: { text: "This link works for **30 minutes** and signs you in on this device." },
      button: { label: welcome ? "Open the library" : "Sign in", href: opts.link },
      note: "After that, come back any time and choose “Sign in” on the Stories page to get a new link sent here.",
    },
    outro: [
      "Your licence renews automatically. To update your card or cancel, reply to this email and we'll sort it out.",
      "If you didn't ask for this email, you can ignore it.",
    ],
    footerNote: "You're receiving this because this address holds an ASOSC library licence.",
  });
}

/**
 * Sent on the reminder days (1, 3, 7 by default) to someone who gave their
 * email and went to Stripe but hasn't paid. The button goes straight back to
 * the same checkout with their email filled in.
 */
export function licenceReminderEmail(opts: { to: string; tierName: string; price: string; payUrl: string; pageUrl: string }): OutgoingEmail {
  return renderEmail({
    to: opts.to,
    subject: "Finish getting access to the Our Story Our Voice documentaries",
    preheader: "Your checkout is still waiting for you.",
    banner: "Educational Resource Library",
    headline: "You're almost there",
    subhead: "Our Story Our Voice documentaries",
    heroUrl: HERO.people,
    heroAlt: "ASOSC community event",
    intro: [
      "Hi there,",
      "You started getting access to the Our Story Our Voice documentaries, but didn't finish checking out.",
    ],
    box: {
      heading: { text: `**${opts.tierName}** · ${opts.price}` },
      button: { label: "Finish checkout", href: opts.payUrl },
      note: `Want to watch the trailer first? It's at ${opts.pageUrl}`,
    },
    outro: ["Questions about licences for your school or organization? Just reply to this email."],
    footerNote: "You're receiving this because this address was entered to get access on asosc.ca. Reply STOP and we won't remind you again.",
  });
}
