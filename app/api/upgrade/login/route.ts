import { NextResponse } from "next/server";
import {
  createSessionToken,
  getUpgradePassword,
  passwordsMatch,
  sessionCookieOptions,
  UPGRADE_COOKIE,
} from "@/lib/gallery-cms/auth";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { password?: string };
    const password = typeof body.password === "string" ? body.password : "";
    const expected = getUpgradePassword();
    if (!passwordsMatch(password, expected)) {
      return NextResponse.json({ error: "Incorrect password" }, { status: 401 });
    }
    const response = NextResponse.json({ ok: true });
    response.cookies.set(UPGRADE_COOKIE, createSessionToken(), sessionCookieOptions());
    return response;
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to sign in";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
