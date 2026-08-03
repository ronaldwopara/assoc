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
  valuesToPayload,
  vendorSteps,
  volunteerSteps,
} from "@/lib/join-community-forms";
import type { FormDraft, FormDraftMap } from "@/lib/join-community-drafts";
import { JOIN_ACTIONS, JOIN_SUCCESS_MESSAGES, joinActionFromSlug } from "@/lib/join-actions";

const NEWSLETTER_ENDPOINT =
  "https://script.google.com/macros/s/AKfycbzVF8QsexivXYnaGj6pvzThDl3sMTauPGAfzVuXOStQ1kYH8bXV2PyTmAMFKmF9lt3NWA/exec";

const VENDOR_ENDPOINT =
  "https://script.google.com/macros/s/AKfycbyeLzT4WE8mlM-Ya4fTdPH1xG0lWN0P3OFjBjexNXkM5MdyMBK5CMxJQC4am4DxQxoq_w/exec";

const VOLUNTEER_ENDPOINT =
  "https://script.google.com/macros/s/AKfycbyRP0rWt41S-vFPL9ItxnR_8hZninBTCrFHbyF7h04VjlpRCZjpE0BeD-a6tiufsv2eqg/exec";

const CONTACT_ENDPOINT =
  "https://script.google.com/macros/s/AKfycbwE4D-Q446q9jXgjHjJD-q07EVRWg6DSvEvGpKKZIGHXszFIdpc3f243jbYNWd6YA/exec";

const MEMBERSHIP_ENDPOINT =
  "https://script.google.com/macros/s/AKfycbwuoS6A1wa0QL-hG1vsdhXzPl8sCX6sUdvb4q2DLWpYoSldMxKiKQB9TJ1OzAEip9yH_w/exec";

const DONATE_ENDPOINT =
  "https://script.google.com/macros/s/AKfycbyYYW2jiGaGMXQd3j5iOJ4-0wlL5YhhowODwzyH3mvgLeWquQRU-fvlOKwxnWzKiLG-/exec";

function postToAppsScript(endpoint: string, payload: Record<string, string>) {
  return new Promise<void>((resolve) => {
    try {
      const body = JSON.stringify(payload);
      const blob = new Blob([body], { type: "text/plain;charset=utf-8" });

      if (navigator.sendBeacon(endpoint, blob)) {
        resolve();
        return;
      }

      const frameName = `apps-script-submit-${Date.now()}`;
      const iframe = document.createElement("iframe");
      const form = document.createElement("form");

      iframe.name = frameName;
      iframe.style.display = "none";

      form.method = "POST";
      form.action = endpoint;
      form.target = frameName;
      form.style.display = "none";

      Object.entries(payload).forEach(([name, value]) => {
        const input = document.createElement("input");
        input.type = "hidden";
        input.name = name;
        input.value = value;
        form.appendChild(input);
      });

      document.body.appendChild(iframe);
      document.body.appendChild(form);
      form.submit();

      window.setTimeout(() => {
        iframe.remove();
        form.remove();
      }, 2000);
    } finally {
      // Apps Script is cross-origin, so submission is intentionally fire-and-forget.
      resolve();
    }
  });
}

async function handleNewsletterSubmit(values: FormValues) {
  const payload = {
    firstName: String(values.firstName ?? ""),
    lastName: String(values.lastName ?? ""),
    email: String(values.email ?? ""),
    strathconaResident: String(values.strathconaResident ?? ""),
  };
  await postToAppsScript(NEWSLETTER_ENDPOINT, payload);
}

async function handleVendorSubmit(values: FormValues) {
  await postToAppsScript(VENDOR_ENDPOINT, valuesToPayload(values));
}

async function handleVolunteerSubmit(values: FormValues) {
  await postToAppsScript(VOLUNTEER_ENDPOINT, valuesToPayload(values));
}

async function handleContactSubmit(values: FormValues) {
  await postToAppsScript(CONTACT_ENDPOINT, valuesToPayload(values));
}

async function handleMembershipSubmit(values: FormValues) {
  await postToAppsScript(MEMBERSHIP_ENDPOINT, valuesToPayload(values));
}

async function handleDonateSubmit(values: FormValues) {
  await postToAppsScript(DONATE_ENDPOINT, valuesToPayload(values));
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
    onSubmit: handleNewsletterSubmit,
  },
  volunteer: {
    steps: volunteerSteps,
    info: "Share your time and skills with the African community in Strathcona County.",
    submitLabel: "Submit",
    onSubmit: handleVolunteerSubmit,
  },
  donate: {
    steps: donateSteps,
    info: "Supports African community programs in Strathcona County.",
    submitLabel: "Donate",
    onSubmit: handleDonateSubmit,
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
    onSubmit: handleVendorSubmit,
  },
  contact: {
    steps: contactSteps,
    info: "Send a message to the ASOSC team — we typically reply within a few days.",
    submitLabel: "Send Message",
    onSubmit: handleContactSubmit,
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
