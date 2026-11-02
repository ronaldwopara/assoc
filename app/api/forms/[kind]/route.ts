import { NextResponse } from "next/server";
import { isFormKind, recordSubmission } from "@/lib/form-submissions";

/** Public endpoint for the website's join/contact forms — writes to the master sheet. */
export async function POST(request: Request, { params }: { params: Promise<{ kind: string }> }) {
  const { kind } = await params;
  if (!isFormKind(kind)) {
    return NextResponse.json({ error: "Unknown form" }, { status: 404 });
  }

  let values: Record<string, string | string[]>;
  try {
    values = (await request.json()) as Record<string, string | string[]>;
    if (!values || typeof values !== "object" || Array.isArray(values)) throw new Error();
  } catch {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
  }

  try {
    const result = await recordSubmission(kind, values);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    console.error(`[forms/${kind}]`, error);
    const message = error instanceof Error ? error.message : "";
    // Only surface validation messages; hide Google/config errors from the public.
    const isValidation = /required/i.test(message);
    return NextResponse.json(
      { error: isValidation ? message : "We couldn't save your form. Please try again." },
      { status: isValidation ? 400 : 500 },
    );
  }
}
