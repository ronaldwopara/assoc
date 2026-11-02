import { NextResponse } from "next/server";
import { isUpgradeAuthenticated } from "@/lib/gallery-cms/auth";
import { sendInvoice } from "@/lib/invoices";

export const maxDuration = 60;

/** Email an invoice with its PDF attached: { number }. */
export async function POST(request: Request) {
  if (!(await isUpgradeAuthenticated())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const body = (await request.json()) as { number?: unknown };
    if (typeof body.number !== "string" || !/^INV-\d{4}-\d{4,}$/.test(body.number)) {
      return NextResponse.json({ error: "Invalid invoice number" }, { status: 400 });
    }
    return NextResponse.json({ ok: true, ...(await sendInvoice(body.number)) });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Couldn't send the invoice" }, { status: 500 });
  }
}
