import { NextResponse } from "next/server";
import { isUpgradeAuthenticated } from "@/lib/gallery-cms/auth";
import {
  getInteracLog,
  manualMatchInterac,
  runInteracPayments,
  type InteracKind,
} from "@/lib/interac-payments";

export const maxDuration = 60;

function isInteracKind(value: unknown): value is InteracKind {
  return value === "membership" || value === "donation" || value === "vendor" || value === "master";
}

export async function GET() {
  try {
    if (!(await isUpgradeAuthenticated())) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const log = await getInteracLog();
    return NextResponse.json({ ok: true, ...log });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load Interac log";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST() {
  try {
    if (!(await isUpgradeAuthenticated())) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const result = await runInteracPayments();
    const log = await getInteracLog();
    return NextResponse.json({ ok: true, ...result, ...log });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Interac check failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    if (!(await isUpgradeAuthenticated())) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await request.json()) as {
      messageId?: string;
      kind?: string;
      rowNumber?: number;
      targetKind?: string;
      amount?: string;
    };
    if (!body.messageId || !isInteracKind(body.kind) || !Number.isInteger(body.rowNumber)) {
      return NextResponse.json({ error: "Missing messageId, kind, or rowNumber" }, { status: 400 });
    }
    const targetKind =
      body.targetKind === "membership" || body.targetKind === "donation" || body.targetKind === "vendor"
        ? body.targetKind
        : undefined;

    const result = await manualMatchInterac({
      messageId: body.messageId,
      kind: body.kind,
      rowNumber: body.rowNumber!,
      targetKind,
      amount: typeof body.amount === "string" ? body.amount : undefined,
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Manual match failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

