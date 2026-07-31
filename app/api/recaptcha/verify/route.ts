import { NextResponse } from "next/server";

type SiteVerifyResponse = {
  success: boolean;
  score?: number;
  action?: string;
  "error-codes"?: string[];
};

export async function POST(request: Request) {
  const secret = process.env.RECAPTCHA_SECRET_KEY;
  if (!secret) {
    return NextResponse.json(
      { success: false, error: "reCAPTCHA is not configured." },
      { status: 500 },
    );
  }

  let token = "";
  try {
    const body = (await request.json()) as { token?: unknown };
    token = typeof body.token === "string" ? body.token.trim() : "";
  } catch {
    return NextResponse.json(
      { success: false, error: "Invalid request." },
      { status: 400 },
    );
  }

  if (!token) {
    return NextResponse.json(
      { success: false, error: "Please complete the reCAPTCHA." },
      { status: 400 },
    );
  }

  const params = new URLSearchParams();
  params.set("secret", secret);
  params.set("response", token);

  const forwarded = request.headers.get("x-forwarded-for");
  const ip = forwarded?.split(",")[0]?.trim();
  if (ip) params.set("remoteip", ip);

  let result: SiteVerifyResponse;
  try {
    const verifyRes = await fetch("https://www.google.com/recaptcha/api/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString(),
    });
    result = (await verifyRes.json()) as SiteVerifyResponse;
  } catch {
    return NextResponse.json(
      { success: false, error: "Could not verify reCAPTCHA. Please try again." },
      { status: 502 },
    );
  }

  if (!result.success) {
    return NextResponse.json(
      { success: false, error: "reCAPTCHA verification failed. Please try again." },
      { status: 400 },
    );
  }

  // v3 tokens include a score + action; reject low-confidence or unexpected actions.
  if (typeof result.score === "number" && result.score < 0.5) {
    return NextResponse.json(
      { success: false, error: "reCAPTCHA verification failed. Please try again." },
      { status: 400 },
    );
  }

  if (result.action && result.action !== "join_submit") {
    return NextResponse.json(
      { success: false, error: "reCAPTCHA verification failed. Please try again." },
      { status: 400 },
    );
  }

  return NextResponse.json({ success: true });
}
