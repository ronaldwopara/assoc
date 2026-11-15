import { createHmac, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { recordCardPayment } from "@/lib/payments";
import { siteOrigin } from "@/lib/licences/session";
import { LICENCE_EVENTS, handleLicenceCheckout, handleLicenceEvent, isLicenceCheckout } from "@/lib/licences/stripe-events";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const TOLERANCE_SECONDS = 5 * 60;

/** Stripe-Signature: t=<unix>,v1=<hex hmac of "t.body">. Rejects stale or forged events. */
function verify(body: string, header: string, secret: string): boolean {
  const parts = Object.fromEntries(
    header.split(",").map((kv) => {
      const i = kv.indexOf("=");
      return [kv.slice(0, i).trim(), kv.slice(i + 1).trim()];
    }),
  );
  const t = Number(parts.t);
  if (!Number.isFinite(t) || Math.abs(Date.now() / 1000 - t) > TOLERANCE_SECONDS) return false;
  const expected = createHmac("sha256", secret).update(`${parts.t}.${body}`).digest("hex");
  const signatures = header
    .split(",")
    .filter((kv) => kv.trim().startsWith("v1="))
    .map((kv) => kv.trim().slice(3));
  return signatures.some((sig) => {
    const a = Buffer.from(sig, "hex");
    const b = Buffer.from(expected, "hex");
    return a.length === b.length && timingSafeEqual(a, b);
  });
}

type CheckoutSession = {
  id: string;
  payment_status?: string;
  amount_total?: number;
  currency?: string;
  created?: number;
  payment_intent?: string | null;
  customer_details?: { email?: string | null; name?: string | null } | null;
  customer_email?: string | null;
  mode?: string;
  payment_link?: string | null;
  subscription?: string | null;
  customer?: string | null;
  metadata?: Record<string, string> | null;
};

/**
 * Stripe webhook for the card payment links. Set STRIPE_WEBHOOK_SECRET and point a
 * Stripe webhook at /api/stripe/webhook for checkout.session.completed,
 * checkout.session.async_payment_succeeded, invoice.paid,
 * customer.subscription.updated and customer.subscription.deleted.
 *
 * Library licence sales (lib/licences) are handled separately and never
 * logged as membership/donation payments.
 */
export async function POST(request: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET?.trim();
  if (!secret) return NextResponse.json({ error: "Stripe webhook isn't configured" }, { status: 503 });

  const body = await request.text();
  if (!verify(body, request.headers.get("stripe-signature") ?? "", secret)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  let event: { type?: string; data?: { object?: unknown } };
  try {
    event = JSON.parse(body);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const type = event.type ?? "";
  if (LICENCE_EVENTS.has(type)) {
    try {
      const result = await handleLicenceEvent(type, event.data?.object);
      return NextResponse.json({ received: true, ...result });
    } catch (error) {
      console.error("[stripe] licence webhook failed:", error);
      return NextResponse.json({ error: "Couldn't update the licence" }, { status: 500 });
    }
  }

  const handled = type === "checkout.session.completed" || type === "checkout.session.async_payment_succeeded";
  const session = event.data?.object as CheckoutSession | undefined;
  if (!handled || !session || session.payment_status !== "paid") {
    return NextResponse.json({ received: true, ignored: true });
  }

  if (isLicenceCheckout(session)) {
    try {
      const result = await handleLicenceCheckout(session, siteOrigin(request));
      return NextResponse.json({ received: true, ...result });
    } catch (error) {
      console.error("[stripe] licence checkout failed:", error);
      return NextResponse.json({ error: "Couldn't record the licence" }, { status: 500 });
    }
  }

  const email = session.customer_details?.email || session.customer_email || "";
  if (!email) return NextResponse.json({ received: true, ignored: "no email" });

  try {
    const result = await recordCardPayment({
      id: `stripe:${session.id}`,
      email,
      name: session.customer_details?.name || "",
      amount: ((session.amount_total ?? 0) / 100).toFixed(2),
      reference: session.payment_intent || session.id,
      receivedAt: session.created ? new Date(session.created * 1000) : new Date(),
    });
    return NextResponse.json({ received: true, ...result });
  } catch (error) {
    console.error("[stripe] webhook failed:", error);
    // 500 makes Stripe retry later.
    return NextResponse.json({ error: "Couldn't record the payment" }, { status: 500 });
  }
}
