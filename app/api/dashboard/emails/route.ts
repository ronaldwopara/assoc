import { NextResponse } from "next/server";
import { isUpgradeAuthenticated } from "@/lib/gallery-cms/auth";
import { AUTO_EMAILS, DEFAULT_COPY, copyFor, isAutoEmailId, sampleAutoEmail, type EditableCopy } from "@/lib/emails";
import { isConfirmationTab, listPendingConfirmations, sendConfirmation } from "@/lib/email-dispatch";
import { getCopyOverrides, resetCopyOverride, saveCopyOverride } from "@/lib/email-store";
import { SENDER_EMAIL, senderCanSend } from "@/lib/mailer";
import { autoSendEnabled, setAutoSend } from "@/lib/settings";

export const maxDuration = 60;

/** Sending status, template previews, and rows still waiting for a confirmation. */
export async function GET() {
  try {
    if (!(await isUpgradeAuthenticated())) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const [canSend, pending, autoSend, overrides] = await Promise.all([
      senderCanSend(),
      listPendingConfirmations(),
      autoSendEnabled(),
      getCopyOverrides(),
    ]);
    return NextResponse.json({
      sender: SENDER_EMAIL,
      canSend,
      autoSend,
      templates: AUTO_EMAILS.map((meta) => {
        const email = sampleAutoEmail(meta.id, overrides);
        return {
          ...meta,
          edited: Boolean(overrides[meta.id]),
          copy: copyFor(meta.id, overrides),
          defaults: DEFAULT_COPY[meta.id],
          subject: email.subject,
          html: email.html,
        };
      }),
      pending: pending.sort((a, b) => b.timestamp.localeCompare(a.timestamp)),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load emails";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/** Send one row's confirmation: { tab, rowNumber }. */
export async function POST(request: Request) {
  try {
    if (!(await isUpgradeAuthenticated())) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const body = (await request.json()) as { tab?: unknown; rowNumber?: unknown };
    if (!isConfirmationTab(body.tab) || !Number.isInteger(body.rowNumber) || (body.rowNumber as number) < 2) {
      return NextResponse.json({ error: "Missing or invalid tab / rowNumber" }, { status: 400 });
    }
    const result = await sendConfirmation(body.tab, body.rowNumber as number);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to send";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/** Turn automatic emails on or off: { autoSend: boolean }. */
export async function PATCH(request: Request) {
  try {
    if (!(await isUpgradeAuthenticated())) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const body = (await request.json()) as { autoSend?: unknown };
    if (typeof body.autoSend !== "boolean") {
      return NextResponse.json({ error: "autoSend must be true or false" }, { status: 400 });
    }
    await setAutoSend(body.autoSend);
    return NextResponse.json({ ok: true, autoSend: body.autoSend });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update setting";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/** Save edited wording for one automatic email: { id, copy }. */
export async function PUT(request: Request) {
  try {
    if (!(await isUpgradeAuthenticated())) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const body = (await request.json()) as { id?: unknown; copy?: Partial<EditableCopy> };
    if (!isAutoEmailId(body.id) || !body.copy || typeof body.copy !== "object") {
      return NextResponse.json({ error: "Missing id or copy" }, { status: 400 });
    }
    await saveCopyOverride(body.id, body.copy);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to save";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/** Reset one automatic email to the default wording: ?id=. */
export async function DELETE(request: Request) {
  try {
    if (!(await isUpgradeAuthenticated())) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const id = new URL(request.url).searchParams.get("id");
    if (!isAutoEmailId(id)) return NextResponse.json({ error: "Unknown email" }, { status: 400 });
    await resetCopyOverride(id);
    return NextResponse.json({ ok: true, copy: DEFAULT_COPY[id] });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to reset";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
