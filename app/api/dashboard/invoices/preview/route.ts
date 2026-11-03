import { isUpgradeAuthenticated } from "@/lib/gallery-cms/auth";
import { draftInvoice, renderInvoicePdf } from "@/lib/invoices";

/** PDF of an invoice that hasn't been saved yet (POST the form fields). */
export async function POST(request: Request) {
  if (!(await isUpgradeAuthenticated())) return new Response("Unauthorized", { status: 401 });
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const pdf = await renderInvoicePdf(
    draftInvoice({
      name: String(body.name ?? ""),
      email: String(body.email ?? ""),
      description: String(body.description ?? ""),
      amount: String(body.amount ?? ""),
      dueDate: typeof body.dueDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.dueDate) ? body.dueDate : undefined,
    }),
  );
  return new Response(new Uint8Array(pdf), { headers: { "Content-Type": "application/pdf", "Cache-Control": "no-store" } });
}
