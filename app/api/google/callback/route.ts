import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  exchangeCodeForTokens,
  fetchGoogleAccountEmail,
  GOOGLE_OAUTH_STATE_COOKIE,
  oauthStateCookieOptions,
  saveGoogleTokens,
} from "@/lib/google-oauth";

function htmlPage(title: string, body: string) {
  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${title}</title>
    <style>
      body { font-family: ui-sans-serif, system-ui, sans-serif; margin: 0; min-height: 100vh; display: grid; place-items: center; background: #0f1115; color: #f4f4f5; }
      main { max-width: 28rem; padding: 2rem; text-align: center; }
      h1 { font-size: 1.25rem; margin: 0 0 0.75rem; }
      p { margin: 0; line-height: 1.5; color: #a1a1aa; }
      code { color: #e4e4e7; }
    </style>
  </head>
  <body><main>${body}</main></body>
</html>`;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const oauthError = url.searchParams.get("error");

  if (oauthError) {
    return new NextResponse(
      htmlPage(
        "Google connection cancelled",
        `<h1>Connection cancelled</h1><p>${oauthError}</p>`,
      ),
      { status: 400, headers: { "Content-Type": "text/html; charset=utf-8" } },
    );
  }

  try {
    if (!code || !state) {
      throw new Error("Missing authorization code or state.");
    }

    const jar = await cookies();
    const expectedState = jar.get(GOOGLE_OAUTH_STATE_COOKIE)?.value;
    if (!expectedState || expectedState !== state) {
      throw new Error("Invalid OAuth state. Try connecting again.");
    }

    const tokens = await exchangeCodeForTokens(code);
    if (!tokens.refreshToken) {
      throw new Error(
        "Google did not return a refresh token. Remove app access in Google Account permissions and try again.",
      );
    }

    const email = await fetchGoogleAccountEmail(tokens.accessToken);
    await saveGoogleTokens({
      refreshToken: tokens.refreshToken,
      accessToken: tokens.accessToken,
      expiryDate: tokens.expiryDate,
      email,
      scope: tokens.scope,
    });

    const response = new NextResponse(
      htmlPage(
        "Google connected",
        `<h1>Google connected</h1><p>Connected as <code>${email}</code>. You can close this tab.</p>`,
      ),
      { status: 200, headers: { "Content-Type": "text/html; charset=utf-8" } },
    );
    response.cookies.set(GOOGLE_OAUTH_STATE_COOKIE, "", oauthStateCookieOptions(0));
    return response;
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to complete Google connection";
    return new NextResponse(
      htmlPage("Google connection failed", `<h1>Connection failed</h1><p>${message}</p>`),
      { status: 400, headers: { "Content-Type": "text/html; charset=utf-8" } },
    );
  }
}
