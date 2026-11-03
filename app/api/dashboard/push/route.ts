import { NextResponse } from "next/server";
import type { PushSubscription } from "web-push";
import { isUpgradeAuthenticated } from "@/lib/gallery-cms/auth";
import { addSubscription, notify, pushKeys, removeSubscription } from "@/lib/push";

async function guard() {
  return (await isUpgradeAuthenticated()) ? null : NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

/** The public key devices subscribe with (null until the VAPID keys are set on Vercel). */
export async function GET() {
  const denied = await guard();
  if (denied) return denied;
  return NextResponse.json({ publicKey: pushKeys()?.publicKey ?? null });
}

/** { subscription, device } → turn on for this device;  { test: endpoint } → send this device a test. */
export async function POST(request: Request) {
  const denied = await guard();
  if (denied) return denied;
  try {
    const body = (await request.json()) as { subscription?: PushSubscription; device?: string; test?: string };
    if (typeof body.test === "string") {
      const r = await notify({ title: "Notifications are working", body: "You'll get one like this whenever a form comes in.", url: "/upgrade?tool=dashboard" }, body.test);
      return NextResponse.json({ ok: r.sent > 0, ...r });
    }
    if (!body.subscription) return NextResponse.json({ error: "Missing subscription" }, { status: 400 });
    const devices = await addSubscription(body.subscription, String(body.device ?? ""));
    return NextResponse.json({ ok: true, devices });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Couldn't turn on notifications" }, { status: 400 });
  }
}

/** { endpoint } → turn off for that device. */
export async function DELETE(request: Request) {
  const denied = await guard();
  if (denied) return denied;
  const body = (await request.json().catch(() => ({}))) as { endpoint?: string };
  if (body.endpoint) await removeSubscription(body.endpoint);
  return NextResponse.json({ ok: true });
}
