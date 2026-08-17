import { NextResponse } from "next/server";
import { isUpgradeAuthenticated } from "@/lib/gallery-cms/auth";
import { getExpenseLog, runExpenseCapture, type ExpenseKind } from "@/lib/expense-capture";

export const maxDuration = 60;

function isExpenseKind(value: unknown): value is ExpenseKind {
  return value === "debit" || value === "invoice" || value === "receipt";
}

export async function GET(request: Request) {
  try {
    if (!(await isUpgradeAuthenticated())) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const kindParam = new URL(request.url).searchParams.get("type");
    const kind = isExpenseKind(kindParam) ? kindParam : undefined;
    const log = await getExpenseLog(kind);
    return NextResponse.json({ ok: true, ...log });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load expenses";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST() {
  try {
    if (!(await isUpgradeAuthenticated())) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const result = await runExpenseCapture();
    const log = await getExpenseLog();
    return NextResponse.json({ ok: true, ...result, ...log });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Expense scan failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
