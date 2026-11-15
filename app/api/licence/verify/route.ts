import { NextResponse } from "next/server";
import { LICENCE_COOKIE, createSessionToken, readLinkToken, sessionCookieOptions } from "@/lib/licences/session";

export const dynamic = "force-dynamic";

/** The emailed link lands here: swap the short-lived link token for a session cookie. */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const email = readLinkToken(url.searchParams.get("t"));
  const back = new URL("/stories", url.origin);

  if (!email) {
    back.searchParams.set("library", "expired");
    return NextResponse.redirect(back);
  }

  back.searchParams.set("library", "signed-in");
  const response = NextResponse.redirect(back);
  response.cookies.set(LICENCE_COOKIE, createSessionToken(email), sessionCookieOptions());
  return response;
}
