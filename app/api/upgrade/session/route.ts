import { NextResponse } from "next/server";
import { isUpgradeAuthenticated } from "@/lib/gallery-cms/auth";

/** Never cache auth — a public/CDN-cached 200 would show the staff FAB to everyone. */
const NO_STORE = {
  "Cache-Control": "private, no-store, max-age=0, must-revalidate",
  Vary: "Cookie",
} as const;

export async function GET() {
  // Always 200: every visitor's browser asks this, and a 401 shows up as a red
  // console error for everyone who isn't staff. The answer is in the body.
  const ok = await isUpgradeAuthenticated();
  return NextResponse.json({ authenticated: ok }, { status: 200, headers: NO_STORE });
}
