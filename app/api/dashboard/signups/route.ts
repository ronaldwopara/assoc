import { NextResponse } from "next/server";
import { isUpgradeAuthenticated } from "@/lib/gallery-cms/auth";
import { linkPaymentToSignup, listUnpaidSignups, setSignupPaid } from "@/lib/payments";

const KINDS = ["Membership", "Donation", "Vendor"] as const;
type Kind = (typeof KINDS)[number];

async function guard() {
  return (await isUpgradeAuthenticated()) ? null : NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

const fail = (error: unknown, status = 500) =>
  NextResponse.json({ error: error instanceof Error ? error.message : "Something went wrong" }, { status });

/** GET ?type=Membership|Donation|Vendor → unpaid sign-ups of that kind. */
export async function GET(request: Request) {
  const denied = await guard();
  if (denied) return denied;
  const type = new URL(request.url).searchParams.get("type") as Kind | null;
  if (!type || !KINDS.includes(type)) return fail(new Error("Unknown type"), 400);
  try {
    return NextResponse.json({ signups: await listUnpaidSignups(type) });
  } catch (error) {
    return fail(error);
  }
}

/**
 * POST { action: "link", messageId, tab, rowNumber } → this payment was for that person.
 * POST { action: "paid", tab, rowNumber, paid } → mark a sign-up paid / not paid.
 */
export async function POST(request: Request) {
  const denied = await guard();
  if (denied) return denied;
  try {
    const body = (await request.json()) as { action?: string; messageId?: string; tab?: string; rowNumber?: number; paid?: boolean };
    const rowNumber = Number(body.rowNumber);
    if (!body.tab || !Number.isInteger(rowNumber) || rowNumber < 2) return fail(new Error("Missing row"), 400);
    if (body.action === "link") {
      if (!body.messageId) return fail(new Error("Missing payment"), 400);
      return NextResponse.json({ ok: true, ...(await linkPaymentToSignup(body.messageId, body.tab, rowNumber)) });
    }
    if (body.action === "paid") {
      await setSignupPaid(body.tab, rowNumber, body.paid !== false);
      return NextResponse.json({ ok: true });
    }
    return fail(new Error("Unknown action"), 400);
  } catch (error) {
    return fail(error);
  }
}
