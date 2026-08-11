import { NextResponse } from "next/server";
import { isUpgradeAuthenticated } from "@/lib/gallery-cms/auth";
import {
  buildGoogleAuthUrl,
  createOAuthState,
  GOOGLE_OAUTH_STATE_COOKIE,
  oauthStateCookieOptions,
} from "@/lib/google-oauth";

export async function GET() {
  try {
    if (!(await isUpgradeAuthenticated())) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const state = createOAuthState();
    const response = NextResponse.redirect(buildGoogleAuthUrl(state));
    response.cookies.set(GOOGLE_OAUTH_STATE_COOKIE, state, oauthStateCookieOptions());
    return response;
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to start Google connection";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
