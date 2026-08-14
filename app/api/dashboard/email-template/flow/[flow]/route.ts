import { NextResponse } from "next/server";
import { isUpgradeAuthenticated } from "@/lib/gallery-cms/auth";
import {
  FLOW_META,
  getFlowEmailTemplate,
  saveFlowEmailTemplate,
  type EmailFlowId,
  type FlowEmailTemplate,
} from "@/lib/flow-email-template";

function isEmailFlowId(value: string): value is EmailFlowId {
  return value in FLOW_META;
}

export async function GET(request: Request, { params }: { params: Promise<{ flow: string }> }) {
  try {
    if (!(await isUpgradeAuthenticated())) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { flow } = await params;
    if (!isEmailFlowId(flow)) {
      return NextResponse.json({ error: "Unknown email flow" }, { status: 400 });
    }

    const template = await getFlowEmailTemplate(flow);
    return NextResponse.json({ template });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to read the email template";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PUT(request: Request, { params }: { params: Promise<{ flow: string }> }) {
  try {
    if (!(await isUpgradeAuthenticated())) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { flow } = await params;
    if (!isEmailFlowId(flow)) {
      return NextResponse.json({ error: "Unknown email flow" }, { status: 400 });
    }

    const body = (await request.json()) as { template?: Partial<FlowEmailTemplate> };
    const t = body.template;
    if (!t || typeof t.body !== "string" || typeof t.subject !== "string") {
      return NextResponse.json({ error: "Missing or invalid template" }, { status: 400 });
    }

    const meta = FLOW_META[flow];
    const template: FlowEmailTemplate = {
      body: t.body,
      subject: t.subject,
      buttonLabel: t.buttonLabel ?? "",
      buttonUrl: t.buttonUrl ?? "",
      preheader: t.preheader ?? "",
    };
    if (meta.hasPaymentBlocks) {
      template.etransferBlock = t.etransferBlock ?? "";
      template.cardBlock = t.cardBlock ?? "";
    }
    if (meta.hasUnsubscribe) {
      template.unsubscribe = t.unsubscribe ?? "";
    }

    await saveFlowEmailTemplate(flow, template);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to save the email template";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
