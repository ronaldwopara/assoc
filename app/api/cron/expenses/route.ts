import { NextResponse } from "next/server";
import { isUpgradeAuthenticated } from "@/lib/gallery-cms/auth";
import { runExpenseCapture } from "@/lib/expense-capture";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

function isCronAuthorized(request: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;
  const header = request.headers.get("authorization") ?? "";
  return header === `Bearer ${secret}`;
}

async function run(request: Request) {
  if (!(isCronAuthorized(request) || (await isUpgradeAuthenticated()))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await runExpenseCapture();
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Expense scan failed";
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
