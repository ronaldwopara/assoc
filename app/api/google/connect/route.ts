import { NextResponse } from "next/server";
import { isUpgradeAuthenticated } from "@/lib/gallery-cms/auth";
import {
  buildGoogleAuthUrl,
  createOAuthState,
  getGoogleOAuthConfig,
  GOOGLE_OAUTH_STATE_COOKIE,
  oauthStateCookieOptions,
} from "@/lib/google-oauth";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Starts "Sign in with Google" for an inbox the website reads or sends from.
 * ?account=support@asosc.ca pre-selects that Google account.
 * Not signed in to the dashboard yet? Go there first, then come straight back.
 * Always runs on the same host Google returns to, so the state cookie survives.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const account = url.searchParams.get("account")?.trim().toLowerCase() ?? "";
  try {
    // Google always returns to the redirect URI's host (asosc.ca). Start there too,
    // or the state cookie is set on another host (www.asosc.ca) and the callback
    // can't find it ("Invalid OAuth state").
    const home = new URL(getGoogleOAuthConfig().redirectUri);
    if (url.host !== home.host) {
      return NextResponse.redirect(new URL(`${url.pathname}${url.search}`, home.origin));
    }
    if (!(await isUpgradeAuthenticated())) {
      const back = `/api/google/connect${account ? `?account=${encodeURIComponent(account)}` : ""}`;
      return NextResponse.redirect(new URL(`/upgrade?next=${encodeURIComponent(back)}`, url.origin));
    }

    const state = createOAuthState();
    const response = NextResponse.redirect(buildGoogleAuthUrl(state, EMAIL_RE.test(account) ? account : undefined));
    response.cookies.set(GOOGLE_OAUTH_STATE_COOKIE, state, oauthStateCookieOptions());
    return response;
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to start Google connection";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
