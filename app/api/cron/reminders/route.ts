import { NextResponse } from "next/server";
import { runReminders } from "@/lib/reminders";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

/** Daily Vercel Cron (GET + Authorization: Bearer $CRON_SECRET). Does nothing while automatic emails are off. */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret || (request.headers.get("authorization") ?? "") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    return NextResponse.json({ ok: true, ...(await runReminders()) });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Reminder run failed" }, { status: 500 });
  }
}
