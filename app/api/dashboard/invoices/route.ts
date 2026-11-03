import { NextResponse } from "next/server";
import { isUpgradeAuthenticated } from "@/lib/gallery-cms/auth";
import { createInvoiceForPayment, createManualInvoice, createManualReceipt, listInvoices, sendInvoice, setInvoicePaid } from "@/lib/invoices";
import { SENDER_EMAIL, senderCanSend } from "@/lib/mailer";

export const maxDuration = 60;

const fail = (error: unknown, status = 500) =>
  NextResponse.json({ error: error instanceof Error ? error.message : "Something went wrong" }, { status });

export async function GET() {
  if (!(await isUpgradeAuthenticated())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const [invoices, canSend] = await Promise.all([listInvoices(), senderCanSend().catch(() => false)]);
    return NextResponse.json({ invoices, canSend, sender: SENDER_EMAIL });
  } catch (error) {
    return fail(error);
  }
}

/**
 * { messageId }                                                        → receipt for an e-Transfer marked "Something else" (created, not sent)
 * { action: "new", name, email, description, amount, paidOn?, paidBy?, send? } → write a receipt by hand, optionally email it
 * { action: "invoice", name, email, description, amount, dueDate?, send? }    → write an invoice to pay, optionally email it
 * { action: "paid", number, paid }                                     → mark an invoice paid / not paid
 */
export async function POST(request: Request) {
  if (!(await isUpgradeAuthenticated())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const body = (await request.json()) as Record<string, unknown>;
    if (body.action === "new" || body.action === "invoice") {
      const common = {
        name: String(body.name ?? ""),
        email: String(body.email ?? ""),
        description: String(body.description ?? ""),
        amount: String(body.amount ?? ""),
      };
      const invoice =
        body.action === "invoice"
          ? await createManualInvoice({ ...common, dueDate: typeof body.dueDate === "string" ? body.dueDate : undefined })
          : await createManualReceipt({
              ...common,
              paidOn: typeof body.paidOn === "string" ? body.paidOn : undefined,
              paidBy: typeof body.paidBy === "string" ? body.paidBy : undefined,
            });
      if (body.send) {
        try {
          await sendInvoice(invoice.number);
          return NextResponse.json({ invoice: { ...invoice, status: "Sent" }, sent: true });
        } catch (error) {
          // Saved but not sent: say so instead of losing the invoice.
          return NextResponse.json({ invoice, sent: false, sendError: error instanceof Error ? error.message : "Couldn't send" });
        }
      }
      return NextResponse.json({ invoice, sent: false });
    }
    if (body.action === "paid") {
      const number = String(body.number ?? "");
      if (!/^INV-\d{4}-\d{4,}$/.test(number)) return fail(new Error("Invalid invoice number"), 400);
      await setInvoicePaid(number, body.paid !== false);
      return NextResponse.json({ ok: true });
    }
    if (typeof body.messageId === "string" && body.messageId) {
      return NextResponse.json({ invoice: await createInvoiceForPayment(body.messageId) });
    }
    return fail(new Error("Unknown request"), 400);
  } catch (error) {
    return fail(error);
  }
}
