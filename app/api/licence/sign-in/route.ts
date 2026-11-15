import { NextResponse } from "next/server";
import { sendEmail } from "@/lib/mailer";
import { tierById } from "@/lib/licences/catalogue";
import { libraryLinkEmail } from "@/lib/licences/emails";
import { createLinkToken, siteOrigin } from "@/lib/licences/session";
import { activeLicenceFor } from "@/lib/licences/store";

export const dynamic = "force-dynamic";

const EMAIL_RE = /^[^\s@,<>]+@[^\s@,<>]+\.[^\s@,<>]+$/;
/** One link per address per minute, per server instance. Stops a stuck button flooding an inbox. */
const recent = new Map<string, number>();
const COOLDOWN_MS = 60_000;

/**
 * "Already licensed? Sign in." Emails a sign-in link if the address holds a
 * running licence. The reply is the same either way, so the form can't be
 * used to find out who is a customer.
 */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { email?: unknown } | null;
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  if (!EMAIL_RE.test(email)) {
    return NextResponse.json({ error: "Please enter the email address your licence is under." }, { status: 400 });
  }

  const reply = NextResponse.json({
    ok: true,
    message: `If ${email} holds a licence, a sign-in link is on its way. It works for 30 minutes.`,
  });

  const last = recent.get(email) ?? 0;
  if (Date.now() - last < COOLDOWN_MS) return reply;
  recent.set(email, Date.now());

  try {
    const licence = await activeLicenceFor(email);
    if (licence) {
      const link = `${siteOrigin(request)}/api/licence/verify?t=${encodeURIComponent(createLinkToken(email))}`;
      await sendEmail(
        libraryLinkEmail({ to: email, name: licence.name, link, kind: "sign-in", tierName: tierById(licence.tier)?.name }),
      );
    }
  } catch (error) {
    console.error("[licence] sign-in failed:", error);
    recent.delete(email);
    return NextResponse.json({ error: "We couldn't send the link just now. Please try again in a minute." }, { status: 500 });
  }
  return reply;
}
