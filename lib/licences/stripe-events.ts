/**
 * Stripe → Licences tab. Called from app/api/stripe/webhook/route.ts after the
 * signature has been verified.
 *
 * Field locations moved between Stripe API versions (current_period_end went
 * from the subscription onto its items; invoice.subscription moved under
 * invoice.parent.subscription_details), so both shapes are read.
 */

import { sendEmail } from "@/lib/mailer";
import { LICENCE_PAYMENT_LINK_IDS, tierById, type LicenceTerm } from "@/lib/licences/catalogue";
import { libraryLinkEmail } from "@/lib/licences/emails";
import { createLinkToken } from "@/lib/licences/session";
import { markAccessEmailSent, recordLicence, updateSubscription } from "@/lib/licences/store";

type Metadata = Record<string, string> | null | undefined;

type Session = {
  id: string;
  amount_total?: number;
  created?: number;
  customer_details?: { email?: string | null; name?: string | null } | null;
  customer_email?: string | null;
  /** The email typed on our site, base64url, so a changed email at Stripe still stops reminders. */
  client_reference_id?: string | null;
  payment_link?: string | null;
  subscription?: string | null;
  customer?: string | null;
  metadata?: Metadata;
};

type Invoice = {
  subscription?: string | null;
  subscription_details?: { metadata?: Metadata } | null;
  parent?: { subscription_details?: { subscription?: string | null; metadata?: Metadata } | null } | null;
  lines?: { data?: Array<{ period?: { end?: number } }> };
  status_transitions?: { paid_at?: number | null };
};

type Subscription = {
  id: string;
  status?: string;
  cancel_at_period_end?: boolean;
  current_period_end?: number;
  items?: { data?: Array<{ current_period_end?: number }> };
  metadata?: Metadata;
};

export const LICENCE_EVENTS = new Set(["invoice.paid", "customer.subscription.updated", "customer.subscription.deleted"]);

const isLicenceMeta = (m: Metadata) => Boolean(m?.licence_tier);
const fromUnix = (s: number | null | undefined) => (s ? new Date(s * 1000) : undefined);

export function isLicenceCheckout(s: { payment_link?: string | null; metadata?: Metadata }): boolean {
  return Boolean((s.payment_link && LICENCE_PAYMENT_LINK_IDS[s.payment_link]) || isLicenceMeta(s.metadata));
}

export async function handleLicenceCheckout(s: Session, origin: string) {
  const fromLink = s.payment_link ? LICENCE_PAYMENT_LINK_IDS[s.payment_link] : undefined;
  const tier = fromLink?.tier ?? s.metadata?.licence_tier ?? "";
  const term = (fromLink?.term ?? s.metadata?.term ?? "year") as LicenceTerm;
  const email = (s.customer_details?.email || s.customer_email || "").trim().toLowerCase();
  if (!email) return { licence: "ignored", reason: "no email" };

  const name = s.customer_details?.name || "";
  const { created, rowNumber, emailSent } = await recordLicence({
    sessionId: s.id,
    subscriptionId: s.subscription || "",
    customerId: s.customer || "",
    email,
    enteredEmail: decodeReference(s.client_reference_id),
    name,
    tier,
    term,
    amount: ((s.amount_total ?? 0) / 100).toFixed(2),
    paidAt: fromUnix(s.created) ?? new Date(),
  });

  // Sent even on a retried event if the first attempt couldn't email; a throw
  // here returns 500 so Stripe tries again.
  if (!emailSent) {
    const link = `${origin}/api/licence/verify?t=${encodeURIComponent(createLinkToken(email))}`;
    await sendEmail(libraryLinkEmail({ to: email, name, link, kind: "welcome", tierName: tierById(tier)?.name }));
    await markAccessEmailSent(rowNumber);
  }
  return { licence: created ? "recorded" : "already recorded", tier };
}

export async function handleLicenceEvent(type: string, object: unknown) {
  if (type === "invoice.paid") {
    const inv = object as Invoice;
    const meta = inv.parent?.subscription_details?.metadata ?? inv.subscription_details?.metadata;
    const subscriptionId = inv.parent?.subscription_details?.subscription ?? inv.subscription ?? "";
    if (!isLicenceMeta(meta) || !subscriptionId) return { licence: "ignored" };
    const periodEnd = Math.max(0, ...(inv.lines?.data ?? []).map((l) => l.period?.end ?? 0));
    // No row yet means the checkout event hasn't landed; it sets a provisional end itself.
    const updated = await updateSubscription({
      subscriptionId,
      status: "Active",
      accessUntil: fromUnix(periodEnd),
      paidAt: fromUnix(inv.status_transitions?.paid_at) ?? new Date(),
    });
    return { licence: updated ? "renewed" : "no row yet" };
  }

  const sub = object as Subscription;
  if (!isLicenceMeta(sub.metadata)) return { licence: "ignored" };

  if (type === "customer.subscription.deleted") {
    await updateSubscription({ subscriptionId: sub.id, status: "Ended", accessUntil: new Date() });
    return { licence: "ended" };
  }

  // customer.subscription.updated
  const periodEnd = sub.current_period_end ?? Math.max(0, ...(sub.items?.data ?? []).map((i) => i.current_period_end ?? 0));
  const updated = await updateSubscription({
    subscriptionId: sub.id,
    status: statusLabel(sub),
    accessUntil: fromUnix(periodEnd),
  });
  return { licence: updated ? "updated" : "no row yet" };
}

function statusLabel(sub: Subscription): string {
  switch (sub.status) {
    case "active":
    case "trialing":
      return sub.cancel_at_period_end ? "Cancels at period end" : "Active";
    case "past_due":
      return "Past due";
    case "canceled":
    case "unpaid":
    case "incomplete_expired":
      return "Ended";
    default:
      return sub.status ? sub.status.replace(/_/g, " ") : "Active";
  }
}

function decodeReference(ref: string | null | undefined): string {
  if (!ref) return "";
  try {
    const v = Buffer.from(ref, "base64url").toString("utf8").trim().toLowerCase();
    return v.includes("@") ? v : "";
  } catch {
    return "";
  }
}
