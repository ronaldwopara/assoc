"use client";

import { useRef } from "react";
import { GuidedForm, type FormValues } from "@/components/guided-form";
import { MembershipCard } from "@/components/membership-card";
import {
  contactSteps,
  donateSteps,
  membershipCategoryOptions,
  membershipSteps,
  newsletterSteps,
  vendorSteps,
  volunteerSteps,
} from "@/lib/join-community-forms";
import type { FormDraft, FormDraftMap } from "@/lib/join-community-drafts";
import { JOIN_ACTIONS, JOIN_SUCCESS_MESSAGES, joinActionFromSlug } from "@/lib/join-actions";
import { renderMembershipCardPng } from "@/lib/membership-card-image";
import { E_TRANSFER_EMAIL } from "@/lib/payment-links";

/** Posts a form to /api/forms/[kind] (writes to the master sheet). Membership and
 *  donation responses carry a payment code, stashed on `values` so the success
 *  screen (which receives this same object) can show it. */
async function submitForm(kind: string, values: FormValues) {
  const res = await fetch(`/api/forms/${kind}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(values),
  });
  const data = (await res.json().catch(() => ({}))) as { error?: string; paymentCode?: string };
  if (!res.ok) throw new Error(data.error || "We couldn't send your form. Please try again.");
  if (data.paymentCode) values.paymentCode = data.paymentCode;
}

async function uploadMembershipCard(values: FormValues): Promise<string | null> {
  const category = membershipCategoryOptions.find(
    (option) => option.value === String(values.membershipCategory ?? ""),
  );
  if (!category) return null;

  const memberName = [values.firstName, values.lastName]
    .map((part) => String(part ?? "").trim())
    .filter(Boolean)
    .join(" ");

  const blob = await renderMembershipCardPng({
    categoryTitle: category.title,
    price: category.price,
    memberName: memberName || undefined,
  });

  const form = new FormData();
  form.append("file", blob, "membership-card.png");
  const res = await fetch("/api/membership/card", { method: "POST", body: form });
  if (!res.ok) return null;
  const data = (await res.json()) as { url?: string };
  return data.url ?? null;
}

async function handleMembershipSubmit(values: FormValues) {
  try {
    const cardUrl = await uploadMembershipCard(values);
    if (cardUrl) values.membershipCardUrl = cardUrl;
  } catch {
    // Card image upload is best-effort — the membership submission must still go through.
  }
  await submitForm("membership", values);
}

const FORM_DEFAULTS: Record<string, FormValues> = {
  newsletter: {},
  volunteer: {},
  donate: { donationAmount: "50" },
  membership: {},
  vendor: {},
  contact: {},
};

const FORM_CONFIG: Record<
  string,
  {
    steps: Parameters<typeof GuidedForm>[0]["steps"];
    info: string;
    submitLabel: string;
    onSubmit: (values: FormValues) => void | Promise<void>;
  }
> = {
  newsletter: {
    steps: newsletterSteps,
    info: "Receive ASOSC news, events, and community updates by email.",
    submitLabel: "Subscribe",
    onSubmit: (values) => submitForm("newsletter", values),
  },
  volunteer: {
    steps: volunteerSteps,
    info: "Share your time and skills with the African community in Strathcona County.",
    submitLabel: "Submit",
    onSubmit: (values) => submitForm("volunteer", values),
  },
  donate: {
    steps: donateSteps,
    info: "Supports African community programs in Strathcona County.",
    submitLabel: "Donate",
    onSubmit: (values) => submitForm("donate", values),
  },
  membership: {
    steps: membershipSteps,
    info: "Official ASOSC membership helps sustain community programs year-round.",
    submitLabel: "Submit",
    onSubmit: handleMembershipSubmit,
  },
  vendor: {
    steps: vendorSteps,
    info: "Register to sell food, crafts, or services at ASOSC events.",
    submitLabel: "Submit Registration",
    onSubmit: (values) => submitForm("vendor", values),
  },
  contact: {
    steps: contactSteps,
    info: "Send a message to the ASOSC team — we typically reply within a few days.",
    submitLabel: "Send Message",
    onSubmit: (values) => submitForm("contact", values),
  },
};

interface JoinFormPanelProps {
  actionSlug: string;
  sessionKey: number;
  drafts: FormDraftMap;
  initialMembershipCategory?: string | null;
  initialContactMessage?: string | null;
  formSucceeded: boolean;
  successMessage: string;
  successValues: FormValues | null;
  onDirtyChange: (dirty: boolean, source: "hydrate" | "edit") => void;
  onDraftChange: (draft: FormDraft, source: "hydrate" | "edit") => void;
  onCompleted: () => void;
  onSuccessChange: (success: boolean, values?: FormValues) => void;
}

export function JoinFormPanel({
  actionSlug,
  sessionKey,
  drafts,
  initialMembershipCategory = null,
  initialContactMessage = null,
  formSucceeded,
  successMessage,
  successValues,
  onDirtyChange,
  onDraftChange,
  onCompleted,
  onSuccessChange,
}: JoinFormPanelProps) {
  const membershipCardRef = useRef<HTMLDivElement>(null);

  const action = joinActionFromSlug(actionSlug) ?? JOIN_ACTIONS[0];
  const config = FORM_CONFIG[action.slug];

  const extraDefaults: FormValues =
    action.slug === "membership" && initialMembershipCategory
      ? { membershipCategory: initialMembershipCategory }
      : action.slug === "contact"
        ? { message: initialContactMessage ?? "" }
        : {};

  const baselineValues = { ...(FORM_DEFAULTS[action.slug] ?? {}), ...extraDefaults };
  const draft = drafts[action.slug];
  const initialValues = draft?.values ?? baselineValues;
  const initialStepIndex = draft?.stepIndex ?? 0;
  const formInstanceKey = `${action.slug}-${sessionKey}`;

  const membershipSuccessCategory =
    action.slug === "membership" && successValues
      ? membershipCategoryOptions.find(
          (option) => option.value === String(successValues.membershipCategory ?? ""),
        )
      : undefined;
  const membershipSuccessName = successValues
    ? [successValues.firstName, successValues.lastName]
        .map((part) => String(part ?? "").trim())
        .filter(Boolean)
        .join(" ")
    : "";

  const successPaymentCode = successValues ? String(successValues.paymentCode ?? "") : "";

  const handleDownloadMembershipCard = async () => {
    const node = membershipCardRef.current;
    if (!node) return;
    try {
      const { toPng } = await import("html-to-image");
      const dataUrl = await toPng(node, { pixelRatio: 3, cacheBust: true });
      const link = document.createElement("a");
      link.download = "asosc-membership-card.png";
      link.href = dataUrl;
      link.click();
    } catch {
      // Download is best-effort; the card stays visible either way.
    }
  };

  if (formSucceeded) {
    return (
      <div className="guided-success relative z-10 mx-auto w-full max-w-md">
        <div className="guided-success__check" aria-hidden="true">
          <span className="guided-success__tick" />
        </div>
        <p className="guided-success__message">{successMessage || "Sent."}</p>
        {successPaymentCode && (
          <div className="guided-payment-code">
            <p className="guided-payment-code__label">Your payment code</p>
            <p className="guided-payment-code__value">{successPaymentCode}</p>
            <p className="guided-payment-code__hint">
              Paying by e-Transfer? Send it to {E_TRANSFER_EMAIL} and type{" "}
              <strong>{successPaymentCode}</strong> in the message box so we can match your payment.
            </p>
          </div>
        )}
        {membershipSuccessCategory && (
          <div className="w-full pt-1">
            <button
              type="button"
              onClick={() => void handleDownloadMembershipCard()}
              className="mcard-download focus-ring-light"
              aria-label="Download your membership card"
            >
              <div ref={membershipCardRef}>
                <MembershipCard
                  categoryTitle={membershipSuccessCategory.title}
                  price={membershipSuccessCategory.price}
                  memberName={membershipSuccessName || undefined}
                />
              </div>
            </button>
            <p className="mcard-download__hint">Tap your card to save it</p>
          </div>
        )}
      </div>
    );
  }

  return (
    <GuidedForm
      formKey={formInstanceKey}
      steps={config.steps}
      initialValues={initialValues}
      baselineValues={baselineValues}
      initialStepIndex={initialStepIndex}
      info={config.info}
      submitLabel={config.submitLabel}
      successMessage={JOIN_SUCCESS_MESSAGES[action.slug] ?? "Sent."}
      onSubmit={config.onSubmit}
      onDirtyChange={onDirtyChange}
      onDraftChange={onDraftChange}
      onCompleted={onCompleted}
      onSuccessChange={onSuccessChange}
    />
  );
}
