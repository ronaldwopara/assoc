import { licenceLinkEmail, licenceReminderEmail as reminder, type CopyOverrides } from "@/lib/emails";
import type { OutgoingEmail } from "@/lib/mailer";

/**
 * The licence emails. Their wording lives with the other automatic emails in
 * lib/emails.ts, so staff can edit it under Dashboard → Automatic emails.
 */
export function libraryLinkEmail(
  opts: { to: string; name?: string; link: string; kind: "welcome" | "sign-in"; tierName?: string },
  overrides?: CopyOverrides,
): OutgoingEmail {
  return licenceLinkEmail(opts, overrides);
}

export function licenceReminderEmail(
  opts: { to: string; tierName: string; price: string; payUrl: string; pageUrl: string },
  overrides?: CopyOverrides,
): OutgoingEmail {
  return reminder(opts, overrides);
}
