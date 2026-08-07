import { NextResponse } from "next/server";
import type { FormValues } from "@/components/guided-form";
import { appendMembershipRow } from "@/lib/membership-sheet";

export async function POST(request: Request) {
  try {
    const values = (await request.json()) as FormValues;
    await appendMembershipRow(values);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to record membership";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
