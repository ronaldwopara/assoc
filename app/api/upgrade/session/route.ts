import { NextResponse } from "next/server";
import { isUpgradeAuthenticated } from "@/lib/gallery-cms/auth";

/** Never cache auth — a public/CDN-cached 200 would show the staff FAB to everyone. */
const NO_STORE = {
  "Cache-Control": "private, no-store, max-age=0, must-revalidate",
  Vary: "Cookie",
} as const;

export async function GET() {
  const ok = await isUpgradeAuthenticated();
  if (!ok) {
    return NextResponse.json(
      { authenticated: false },
      { status: 401, headers: NO_STORE },
    );
  }
  return NextResponse.json(
    { authenticated: true },
    { status: 200, headers: NO_STORE },
  );
}
