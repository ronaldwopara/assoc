import { NextResponse } from "next/server";
import { isUpgradeAuthenticated } from "@/lib/gallery-cms/auth";
import { getPayments, isPaymentType, runPayments, setPaymentType } from "@/lib/payments";

export const maxDuration = 60;

/** Payments tab, newest first. */
export async function GET() {
  try {
    if (!(await isUpgradeAuthenticated())) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ ok: true, ...(await getPayments()) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load payments";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/** "Check inbox now" — logs any new e-Transfers, then returns the refreshed list. */
export async function POST() {
  try {
    if (!(await isUpgradeAuthenticated())) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const result = await runPayments();
    return NextResponse.json({ ok: true, result, ...(await getPayments()) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Payment check failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/** Change a payment's Type: { messageId, type }. */
export async function PATCH(request: Request) {
  try {
    if (!(await isUpgradeAuthenticated())) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const body = (await request.json()) as { messageId?: unknown; type?: unknown };
    if (typeof body.messageId !== "string" || !body.messageId || !isPaymentType(body.type)) {
      return NextResponse.json({ error: "Missing messageId or invalid type" }, { status: 400 });
    }
    await setPaymentType(body.messageId, body.type);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update payment";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
