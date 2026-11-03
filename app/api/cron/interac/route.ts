import { NextResponse } from "next/server";
import { isUpgradeAuthenticated } from "@/lib/gallery-cms/auth";
import { runPayments } from "@/lib/payments";
import { syncEventForms } from "@/lib/event-forms";
import { retryRecentConfirmations } from "@/lib/email-dispatch";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

function isCronAuthorized(request: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;
  return (request.headers.get("authorization") ?? "") === `Bearer ${secret}`;
}

async function run(request: Request) {
  if (!(isCronAuthorized(request) || (await isUpgradeAuthenticated()))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const payments = await runPayments();
    // Also copy in new event Google Form responses (best effort; never fails the payment check).
    const eventForms = await syncEventForms().catch((error: unknown) => ({ error: error instanceof Error ? error.message : String(error) }));
    // Resend any recent confirmation that failed the first time (best effort).
    const retried = await retryRecentConfirmations().catch((error: unknown) => ({ error: error instanceof Error ? error.message : String(error) }));
    return NextResponse.json({ ok: true, ...payments, eventForms, retried });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Payment check failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/** Vercel Cron hits this with GET + Authorization: Bearer $CRON_SECRET. */
export async function GET(request: Request) {
  return run(request);
}

/** Staff can also POST here when signed in. */
export async function POST(request: Request) {
  return run(request);
}
