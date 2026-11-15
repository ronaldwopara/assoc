import { NextResponse } from "next/server";
import { LICENCE_COOKIE, sessionCookieOptions } from "@/lib/licences/session";

export async function POST() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(LICENCE_COOKIE, "", sessionCookieOptions(0));
  return response;
}
