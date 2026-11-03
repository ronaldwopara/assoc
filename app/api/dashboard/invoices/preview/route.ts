import { isUpgradeAuthenticated } from "@/lib/gallery-cms/auth";
import { draftInvoice, draftReceipt, renderInvoicePdf } from "@/lib/invoices";

/** PDF of a receipt or invoice that hasn't been saved yet (POST the form fields; kind: "invoice" for an invoice to pay). */
export async function POST(request: Request) {
  if (!(await isUpgradeAuthenticated())) return new Response("Unauthorized", { status: 401 });
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const common = {
    name: String(body.name ?? ""),
    email: String(body.email ?? ""),
    description: String(body.description ?? ""),
    amount: String(body.amount ?? ""),
  };
  const pdf = await renderInvoicePdf(
    body.kind === "invoice"
      ? draftInvoice({ ...common, dueDate: typeof body.dueDate === "string" ? body.dueDate : undefined })
      : draftReceipt({
          ...common,
          paidOn: typeof body.paidOn === "string" ? body.paidOn : undefined,
          paidBy: typeof body.paidBy === "string" ? body.paidBy : undefined,
        }),
  );
  return new Response(new Uint8Array(pdf), { headers: { "Content-Type": "application/pdf", "Cache-Control": "no-store" } });
}
