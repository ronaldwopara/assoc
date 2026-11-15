import { NextResponse } from "next/server";
import { tierById, type LicenceTerm } from "@/lib/licences/catalogue";
import { recordCheckoutStarted } from "@/lib/licences/store";

export const dynamic = "force-dynamic";

const EMAIL_RE = /^[^\s@,<>]+@[^\s@,<>]+\.[^\s@,<>]+$/;

/**
 * Called as the buyer leaves for Stripe. Saves their email as "Checkout
 * started" so the daily reminder run can nudge them if they don't pay.
 * Never blocks checkout: any failure is logged and still answers ok.
 */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { email?: unknown; tier?: unknown; term?: unknown } | null;
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  const tier = tierById(typeof body?.tier === "string" ? body.tier : "");
  const term: LicenceTerm | null = body?.term === "month" || body?.term === "year" ? body.term : null;
  const price = tier && term ? tier.prices[term] : undefined;
  if (!EMAIL_RE.test(email) || !tier || !term || price === undefined) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  try {
    await recordCheckoutStarted({ email, tier: tier.id, term, amount: price.toFixed(2) });
  } catch (error) {
    console.error("[licence] checkout-started not saved:", error);
  }
  return NextResponse.json({ ok: true });
}
