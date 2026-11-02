import { NextResponse } from "next/server";
import { isUpgradeAuthenticated } from "@/lib/gallery-cms/auth";
import { createInvoiceForPayment, listInvoices } from "@/lib/invoices";

export async function GET() {
  if (!(await isUpgradeAuthenticated())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    return NextResponse.json({ invoices: await listInvoices() });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to load invoices" }, { status: 500 });
  }
}

/** Create (or fetch) the invoice for a payment: { messageId }. */
export async function POST(request: Request) {
  if (!(await isUpgradeAuthenticated())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const body = (await request.json()) as { messageId?: unknown };
    if (typeof body.messageId !== "string" || !body.messageId) {
      return NextResponse.json({ error: "Missing messageId" }, { status: 400 });
    }
    return NextResponse.json({ invoice: await createInvoiceForPayment(body.messageId) });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Couldn't create the invoice" }, { status: 500 });
  }
}
