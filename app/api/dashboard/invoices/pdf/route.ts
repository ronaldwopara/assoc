import { isUpgradeAuthenticated } from "@/lib/gallery-cms/auth";
import { getInvoice, invoiceFilename, renderInvoicePdf } from "@/lib/invoices";

/** Download an invoice PDF: ?number=INV-2026-0001. */
export async function GET(request: Request) {
  if (!(await isUpgradeAuthenticated())) return new Response("Unauthorized", { status: 401 });
  const number = new URL(request.url).searchParams.get("number") ?? "";
  if (!/^INV-\d{4}-\d{4,}$/.test(number)) return new Response("Invalid invoice number", { status: 400 });
  const invoice = await getInvoice(number);
  if (!invoice) return new Response("Invoice not found", { status: 404 });
  const pdf = await renderInvoicePdf(invoice);
  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${invoiceFilename(invoice)}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
