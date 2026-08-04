import { NextResponse } from "next/server";
import { sessionCookieOptions, UPGRADE_COOKIE } from "@/lib/gallery-cms/auth";

export async function POST() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(UPGRADE_COOKIE, "", sessionCookieOptions(0));
  return response;
}
