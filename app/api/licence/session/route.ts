import { NextResponse } from "next/server";
import { tierById } from "@/lib/licences/catalogue";
import { sessionEmail } from "@/lib/licences/session";
import { activeLicenceFor } from "@/lib/licences/store";

export const dynamic = "force-dynamic";

/** Who is signed in, and whether their licence is still running. */
export async function GET() {
  const email = await sessionEmail();
  if (!email) return NextResponse.json({ signedIn: false });
  try {
    const licence = await activeLicenceFor(email);
    return NextResponse.json({
      signedIn: true,
      email,
      active: Boolean(licence),
      tier: licence ? tierById(licence.tier)?.name ?? licence.tier : null,
      accessUntil: licence?.accessUntil ?? null,
    });
  } catch (error) {
    console.error("[licence] session lookup failed:", error);
    return NextResponse.json({ signedIn: true, email, active: false, error: "lookup failed" }, { status: 503 });
  }
}
