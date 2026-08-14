import { NextResponse } from "next/server";
import { isUpgradeAuthenticated } from "@/lib/gallery-cms/auth";
import {
  getMembershipEmailTemplate,
  saveMembershipEmailTemplate,
  type MembershipEmailTemplate,
} from "@/lib/membership-email-template";

export async function GET() {
  try {
    if (!(await isUpgradeAuthenticated())) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const template = await getMembershipEmailTemplate();
    return NextResponse.json({ template });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to read the email template";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    if (!(await isUpgradeAuthenticated())) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await request.json()) as { template?: Partial<MembershipEmailTemplate> };
    const t = body.template;
    if (!t || typeof t.body !== "string" || typeof t.subject !== "string") {
      return NextResponse.json({ error: "Missing or invalid template" }, { status: 400 });
    }

    const template: MembershipEmailTemplate = {
      body: t.body,
      subject: t.subject,
      buttonLabel: t.buttonLabel ?? "",
      buttonUrl: t.buttonUrl ?? "",
      preheader: t.preheader ?? "",
      paymentBlock: t.paymentBlock ?? "",
    };

    await saveMembershipEmailTemplate(template);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to save the email template";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
