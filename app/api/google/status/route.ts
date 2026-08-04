import { NextResponse } from "next/server";
import { getGoogleConnectionStatus } from "@/lib/google-oauth";

export async function GET() {
  try {
    const status = await getGoogleConnectionStatus();
    return NextResponse.json(status);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to read Google connection status";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
