import { NextResponse } from "next/server";
import { isUpgradeAuthenticated } from "@/lib/gallery-cms/auth";
import { runReminders } from "@/lib/reminders";
import { getReminderSchedule, setReminderSchedule } from "@/lib/settings";

export const maxDuration = 60;

async function guard() {
  return (await isUpgradeAuthenticated()) ? null : NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

export async function GET() {
  const denied = await guard();
  if (denied) return denied;
  try {
    return NextResponse.json({ schedule: await getReminderSchedule() });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed" }, { status: 500 });
  }
}

/** Save the reminder schedule: { days: [1, 3, 7] } (days after first contact). */
export async function PUT(request: Request) {
  const denied = await guard();
  if (denied) return denied;
  try {
    const body = (await request.json()) as { days?: unknown };
    return NextResponse.json({ ok: true, schedule: await setReminderSchedule(body) });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to save" }, { status: 500 });
  }
}

/** Run reminders and vendor approvals now (even if automatic emails are off). */
export async function POST() {
  const denied = await guard();
  if (denied) return denied;
  try {
    return NextResponse.json({ ok: true, ...(await runReminders({ force: true })) });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Reminder run failed" }, { status: 500 });
  }
}
