import { NextResponse } from "next/server";
import { isUpgradeAuthenticated } from "@/lib/gallery-cms/auth";
import { addEventForm, listEventForms, removeEventForm, syncEventForms } from "@/lib/event-forms";

export const maxDuration = 60;

const fail = (error: unknown, status = 500) =>
  NextResponse.json({ error: error instanceof Error ? error.message : "Something went wrong" }, { status });

export async function GET() {
  if (!(await isUpgradeAuthenticated())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    return NextResponse.json({ forms: await listEventForms() });
  } catch (error) {
    return fail(error);
  }
}

/** { action: "add", name, kind, link, tab? } | { action: "remove", id } | { action: "sync" } */
export async function POST(request: Request) {
  if (!(await isUpgradeAuthenticated())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const body = (await request.json()) as Record<string, unknown>;
    if (body.action === "add") {
      const form = await addEventForm({
        name: String(body.name ?? ""),
        kind: body.kind === "event" ? "event" : "volunteer",
        link: String(body.link ?? ""),
        tab: typeof body.tab === "string" ? body.tab : undefined,
      });
      return NextResponse.json({ form, forms: await listEventForms() });
    }
    if (body.action === "remove" && typeof body.id === "string") {
      await removeEventForm(body.id);
      return NextResponse.json({ forms: await listEventForms() });
    }
    if (body.action === "sync") {
      const result = await syncEventForms();
      return NextResponse.json({ result, forms: await listEventForms() });
    }
    return fail(new Error("Unknown request"), 400);
  } catch (error) {
    return fail(error, 400);
  }
}
