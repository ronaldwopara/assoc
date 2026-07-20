"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { ChevronLeft, ChevronRight, Mail, HandHeart, Heart, IdCard, MessageCircle, Store } from "lucide-react";
import { ExpandableTabs } from "@/components/expandable-tabs";
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
import {
  clearFormDraft,
  readFormDrafts,
  upsertFormDraft,
  writeFormDrafts,
  type FormDraft,
  type FormDraftMap,
} from "@/lib/join-community-drafts";
import { navTextureBackgroundStyleFromCssVar } from "@/lib/nav-texture";

const NAVBAR_IMAGE_OPACITY = 0.95;
const NEWSLETTER_ENDPOINT =
  "https://script.google.com/macros/s/AKfycbzVF8QsexivXYnaGj6pvzThDl3sMTauPGAfzVuXOStQ1kYH8bXV2PyTmAMFKmF9lt3NWA/exec";

const navbarBackgroundStyle = navTextureBackgroundStyleFromCssVar(NAVBAR_IMAGE_OPACITY);

const FORM_DEFAULTS: Record<string, FormValues> = {
  Newsletter: {},
  Volunteer: {},
  Donate: { donationAmount: "50" },
  Membership: {},
  Vendor: {},
  Contact: {},
};

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

const actionTabs = [
  { title: "Newsletter", icon: Mail },
  { title: "Volunteer", icon: Heart },
  { title: "Donate", icon: HandHeart },
  { title: "Membership", icon: IdCard },
  { title: "Vendor", icon: Store },
  { title: "Contact", icon: MessageCircle },
];

interface JoinCommunityModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialAction?: string | null;
  initialContactMessage?: string | null;
  /** Pre-selects a membership category (value from membershipCategoryOptions). */
  initialMembershipCategory?: string | null;
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

async function handleGenericSubmit(_values: FormValues) {
  // Endpoints for remaining forms can be wired the same way as newsletter.
  await Promise.resolve();
}

export function JoinCommunityModal({
  isOpen,
  onClose,
  initialAction = null,
  initialContactMessage = null,
  initialMembershipCategory = null,
}: JoinCommunityModalProps) {
  const [mounted, setMounted] = useState(false);
  const overlayRef = useRef<HTMLDivElement>(null);

  const initialActionIndex = actionTabs.findIndex((tab) => tab.title === initialAction);
  const defaultActionIndex = initialActionIndex >= 0 ? initialActionIndex : 0;
  const [activeActionIndex, setActiveActionIndex] = useState<number | null>(defaultActionIndex);
  const [sessionKey, setSessionKey] = useState(0);
  const [drafts, setDrafts] = useState<FormDraftMap>({});
  const [formDirty, setFormDirty] = useState(false);
  const [tabsAwake, setTabsAwake] = useState(false);
  const [formSucceeded, setFormSucceeded] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [successValues, setSuccessValues] = useState<FormValues | null>(null);
  const membershipCardRef = useRef<HTMLDivElement>(null);

  const tabsLocked = formDirty && !tabsAwake;

  const requestActionSwitch = (nextIndex: number) => {
    if (nextIndex === activeActionIndex) {
      if (tabsLocked) setTabsAwake(true);
      return;
    }

    if (formDirty && !tabsAwake) {
      setTabsAwake(true);
      return;
    }

    setActiveActionIndex(nextIndex);
    setTabsAwake(true);
    setFormDirty(false);
    setFormSucceeded(false);
    setSuccessMessage("");
    setSuccessValues(null);
  };

  const goToPreviousAction = () => {
    const activeIndex = activeActionIndex ?? 0;
    requestActionSwitch((activeIndex - 1 + actionTabs.length) % actionTabs.length);
  };

  const goToNextAction = () => {
    const activeIndex = activeActionIndex ?? 0;
    requestActionSwitch((activeIndex + 1) % actionTabs.length);
  };

  const handleDirtyChange = (
    formId: string,
    dirty: boolean,
    source: "hydrate" | "edit",
  ) => {
    setFormDirty(dirty);

    if (source === "hydrate") return;

    if (dirty) {
      setTabsAwake(false);
      return;
    }

    setDrafts((current) => {
      if (!(formId in current)) return current;
      const next = clearFormDraft(current, formId);
      writeFormDrafts(next);
      return next;
    });
  };

  const handleDraftChange = (
    formId: string,
    draft: FormDraft,
    source: "hydrate" | "edit",
  ) => {
    setDrafts((current) => {
      const next = upsertFormDraft(current, formId, draft);
      writeFormDrafts(next);
      return next;
    });
    if (source === "edit") setTabsAwake(false);
  };

  const handleFormCompleted = (formId: string) => {
    setDrafts((current) => {
      const next = clearFormDraft(current, formId);
      writeFormDrafts(next);
      return next;
    });
    setFormDirty(false);
    setTabsAwake(false);
  };

  const getFormSeed = (formId: string, extraDefaults: FormValues = {}) => {
    const baseline = { ...(FORM_DEFAULTS[formId] ?? {}), ...extraDefaults };
    const draft = drafts[formId];
    return {
      baselineValues: baseline,
      initialValues: draft?.values ?? baseline,
      initialStepIndex: draft?.stepIndex ?? 0,
    };
  };

  useEffect(() => {
    setMounted(true);
    setDrafts(readFormDrafts());
  }, []);

  useEffect(() => {
    if (isOpen) {
      setActiveActionIndex(defaultActionIndex);
      setSessionKey((key) => key + 1);
      setDrafts(readFormDrafts());
      setFormDirty(false);
      setTabsAwake(false);
      setFormSucceeded(false);
      setSuccessMessage("");
      setSuccessValues(null);
    }
  }, [isOpen, defaultActionIndex, initialContactMessage]);

  useEffect(() => {
    if (!isOpen || !formDirty) return;

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [isOpen, formDirty]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (!isOpen) return;
    const root = document.documentElement;
    const body = document.body;
    const prevHtml = root.style.overflow;
    const prevBody = body.style.overflow;
    root.style.overflow = "hidden";
    body.style.overflow = "hidden";
    return () => {
      root.style.overflow = prevHtml;
      body.style.overflow = prevBody;
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const overlay = overlayRef.current;
    // Never blur safe-area strips (or the orientation lock): filter on those
    // fixed edge layers leaves a stale frosted composite in iOS Safari's
    // notch / home-indicator regions after the modal closes.
    const targets = [...document.body.children].filter((el) => {
      if (el === overlay || el.tagName === "SCRIPT") return false;
      if (!(el instanceof HTMLElement)) return false;
      return (
        !el.classList.contains("safe-area-strip") &&
        !el.classList.contains("orientation-lock")
      );
    });
    targets.forEach((el) => el.classList.add("page-blur-target", "is-blurred"));
    return () => {
      targets.forEach((el) => {
        el.classList.remove("is-blurred", "page-blur-target");
      });
    };
  }, [isOpen]);

  const [isDesktop, setIsDesktop] = useState(false);
  const reduceMotion = useReducedMotion();
  const sheetContentRef = useRef<HTMLDivElement>(null);
  const measureSheetRef = useRef<() => void>(() => {});
  const [sheetHeight, setSheetHeight] = useState<number | "auto">("auto");
  const [heightReady, setHeightReady] = useState(false);
  // When the on-screen keyboard opens on mobile, the fixed overlay stays sized
  // to the (unshrunk) layout viewport, so an items-end sheet is anchored behind
  // the keyboard and leaves a gap. Track the visual viewport and pin the sheet
  // to it instead. Null = no keyboard overlap / desktop (use default layout).
  const [kbViewport, setKbViewport] = useState<{ top: number; height: number } | null>(null);

  useEffect(() => {
    const media = window.matchMedia("(min-width: 768px)");
    const updateViewport = () => setIsDesktop(media.matches);
    updateViewport();
    media.addEventListener("change", updateViewport);
    return () => media.removeEventListener("change", updateViewport);
  }, []);

  useEffect(() => {
    const vv = window.visualViewport;
    if (!isOpen || isDesktop || !vv) {
      setKbViewport(null);
      return;
    }
    const update = () => {
      // How much of the layout viewport the keyboard (or other UI) covers.
      const covered = window.innerHeight - vv.height - vv.offsetTop;
      setKbViewport(covered > 60 ? { top: vv.offsetTop, height: vv.height } : null);
    };
    update();
    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    return () => {
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
      setKbViewport(null);
    };
  }, [isOpen, isDesktop]);

  useLayoutEffect(() => {
    // Reset height only after exit finishes (see onExitComplete) so close
    // animations are not interrupted by snapping height to "auto".
    if (!isOpen) return;

    const node = sheetContentRef.current;
    if (!node || typeof ResizeObserver === "undefined") return;

    const maxSheetHeight = () => {
      const vhCap = window.innerHeight * (isDesktop ? 0.75 : 0.78);
      const remCap = isDesktop ? 40 * 16 : Number.POSITIVE_INFINITY;
      return Math.min(vhCap, remCap);
    };

    // offsetHeight ignores CSS transforms (e.g. desktop open scale: 0.94),
    // so the first lock matches the post-tab-switch height.
    const measure = () => {
      const next = Math.ceil(node.offsetHeight);
      if (next <= 0) return;
      const capped = Math.min(next, maxSheetHeight());
      setSheetHeight((prev) => (prev === capped ? prev : capped));
    };

    measureSheetRef.current = measure;
    measure();
    const readyFrame = requestAnimationFrame(() => setHeightReady(true));
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => {
      cancelAnimationFrame(readyFrame);
      observer.disconnect();
    };
  }, [isOpen, activeActionIndex, sessionKey, isDesktop]);

  const resetSheetHeight = () => {
    setSheetHeight("auto");
    setHeightReady(false);
  };

  const handleDialogAnimationComplete = () => {
    if (isOpen) measureSheetRef.current();
  };

  const dialogMotion = isDesktop
    ? {
        // Opacity is handled by the overlay so we don't double-fade.
        initial: { scale: 0.94, y: 24 },
        animate: { scale: 1, y: 0 },
        exit: { scale: 0.96, y: 16 },
      }
    : {
        initial: { y: "100%" },
        animate: { y: 0 },
        exit: { y: "100%" },
      };

  const heightTransition = reduceMotion
    ? { duration: 0 }
    : { duration: 0.38, ease: [0.16, 1, 0.3, 1] as const };

  const dialogTransition = isDesktop
    ? {
        duration: 0.4,
        ease: [0.16, 1, 0.3, 1] as const,
        height: heightTransition,
      }
    : {
        y: { type: "spring" as const, stiffness: 380, damping: 36 },
        height: heightTransition,
      };

  const activeTitle = actionTabs[activeActionIndex ?? -1]?.title;
  const formInstanceKey = `${activeTitle ?? "form"}-${sessionKey}`;
  const animatedHeight =
    reduceMotion || !heightReady || sheetHeight === "auto" ? "auto" : sheetHeight;

  // With the keyboard up, size the sheet to min(content, space-above-keyboard).
  // When content fits, it stays content-sized (no bottom gap); when it doesn't,
  // it's capped to the visible height and the body scrolls internally (header
  // and footer stay pinned), so the top is never pushed out of view.
  const keyboardHeight = kbViewport
    ? Math.min(
        typeof sheetHeight === "number" ? sheetHeight : kbViewport.height,
        kbViewport.height,
      )
    : null;

  const newsletterSeed = getFormSeed("Newsletter");
  const volunteerSeed = getFormSeed("Volunteer");
  const donateSeed = getFormSeed("Donate");
  const membershipSeed = getFormSeed(
    "Membership",
    initialMembershipCategory ? { membershipCategory: initialMembershipCategory } : {},
  );
  const vendorSeed = getFormSeed("Vendor");
  const contactSeed = getFormSeed("Contact", {
    message: initialContactMessage ?? "",
  });

  const SUCCESS_MESSAGES: Record<string, string> = {
    Newsletter: "Thanks! You're on the newsletter list.",
    Volunteer: "Thanks for volunteering with ASOSC!",
    Donate: "Thank you for your generous donation!",
    Membership: "Thanks! Your membership application was received.",
    Vendor: "Thanks! Your vendor registration was received.",
    Contact: "Thanks! Your message was sent.",
  };

  const handleFormSuccessChange = (success: boolean, values?: FormValues) => {
    setFormSucceeded(success);
    if (success) {
      setSuccessMessage(SUCCESS_MESSAGES[activeTitle ?? ""] ?? "Sent.");
      setSuccessValues(values ?? null);
    }
  };

  const membershipSuccessCategory =
    activeTitle === "Membership" && successValues
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

  const formGuards = (formId: string) => ({
    onDirtyChange: (dirty: boolean, source: "hydrate" | "edit") =>
      handleDirtyChange(formId, dirty, source),
    onDraftChange: (draft: FormDraft, source: "hydrate" | "edit") =>
      handleDraftChange(formId, draft, source),
    onCompleted: () => handleFormCompleted(formId),
    onSuccessChange: handleFormSuccessChange,
  });

  if (!mounted) return null;

  return createPortal(
    <AnimatePresence onExitComplete={resetSheetHeight}>
      {isOpen && (
        <motion.div
          key="join-community-modal"
          ref={overlayRef}
          className="join-modal-overlay fixed inset-0 z-(--z-modal) flex items-end justify-center overflow-x-hidden md:items-center"
          style={
            kbViewport
              ? { top: kbViewport.top, height: kbViewport.height, bottom: "auto" }
              : undefined
          }
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{
            // Mobile stays mounted long enough for the sheet spring to finish.
            duration: reduceMotion ? 0 : isDesktop ? 0.35 : 0.55,
            ease: "easeOut",
          }}
        >
          <div
            className="absolute inset-0 bg-black/30"
            onClick={onClose}
            aria-hidden="true"
          />

          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="join-community-heading"
            className="join-modal relative flex w-full max-w-xl flex-col overflow-hidden rounded-t-2xl md:rounded-2xl"
            style={{
              backgroundColor: "var(--cream-light)",
              maxHeight: isDesktop
                ? "min(75vh, 40rem)"
                : kbViewport
                  ? `${kbViewport.height}px`
                  : "78dvh",
            }}
            initial={dialogMotion.initial}
            animate={{
              ...dialogMotion.animate,
              height: keyboardHeight ?? animatedHeight,
            }}
            exit={dialogMotion.exit}
            transition={dialogTransition}
            onAnimationComplete={handleDialogAnimationComplete}
          >
            <div
              ref={sheetContentRef}
              className={`flex w-full flex-col${kbViewport ? " min-h-0 flex-1" : ""}`}
            >
            <div className="join-modal__header relative shrink-0">
              <div className="absolute inset-0" style={navbarBackgroundStyle} aria-hidden="true" />

              <button
                type="button"
                onClick={onClose}
                aria-label="Close dialog"
                className="join-modal__close focus-ring-light absolute top-3 right-3 z-20 flex h-9 w-9 cursor-pointer items-center justify-center rounded-full transition-transform duration-150 hover:scale-110 active:scale-95 md:top-3.5 md:right-3.5"
              >
                <svg
                  viewBox="0 0 24 24"
                  className="h-6 w-6"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="3"
                  aria-hidden="true"
                >
                  <path strokeLinecap="round" d="M6 6l12 12M18 6L6 18" />
                </svg>
              </button>

              <div className="relative z-10 flex justify-center pt-3 md:hidden" aria-hidden="true">
                <div className="h-1 w-10 rounded-full bg-(--yellow)" />
              </div>

              <h2
                id="join-community-heading"
                className="relative z-10 px-10 pt-3 pb-5 text-center text-lg font-bold text-white md:px-6 md:pt-4 md:pb-6 md:text-xl"
              >
                Join Our Community
              </h2>
            </div>

            <div className="relative flex min-h-0 shrink flex-col overflow-y-auto px-5 pt-3 md:px-8 md:pt-5">
              <div className="join-modal__grain" aria-hidden="true" />

              {formSucceeded ? (
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
              ) : (
                <>
              {activeTitle === "Newsletter" && (
                <GuidedForm
                  formKey={formInstanceKey}
                  steps={newsletterSteps}
                  initialValues={newsletterSeed.initialValues}
                  baselineValues={newsletterSeed.baselineValues}
                  initialStepIndex={newsletterSeed.initialStepIndex}
                  info="Receive ASOSC news, events, and community updates by email."
                  submitLabel="Subscribe"
                  successMessage="Thanks! You're on the newsletter list."
                  onSubmit={handleNewsletterSubmit}
                  {...formGuards("Newsletter")}
                />
              )}

              {activeTitle === "Volunteer" && (
                <GuidedForm
                  formKey={formInstanceKey}
                  steps={volunteerSteps}
                  initialValues={volunteerSeed.initialValues}
                  baselineValues={volunteerSeed.baselineValues}
                  initialStepIndex={volunteerSeed.initialStepIndex}
                  info="Share your time and skills with the African community in Strathcona County."
                  submitLabel="Submit"
                  successMessage="Thanks for volunteering with ASOSC!"
                  onSubmit={async (values) => {
                    await handleGenericSubmit(valuesToPayload(values));
                  }}
                  {...formGuards("Volunteer")}
                />
              )}

              {activeTitle === "Donate" && (
                <GuidedForm
                  formKey={formInstanceKey}
                  steps={donateSteps}
                  initialValues={donateSeed.initialValues}
                  baselineValues={donateSeed.baselineValues}
                  initialStepIndex={donateSeed.initialStepIndex}
                  info="Supports African community programs in Strathcona County."
                  submitLabel="Donate"
                  successMessage="Thank you for your generous donation!"
                  onSubmit={async (values) => {
                    await handleGenericSubmit(valuesToPayload(values));
                  }}
                  {...formGuards("Donate")}
                />
              )}

              {activeTitle === "Membership" && (
                <GuidedForm
                  formKey={formInstanceKey}
                  steps={membershipSteps}
                  initialValues={membershipSeed.initialValues}
                  baselineValues={membershipSeed.baselineValues}
                  initialStepIndex={membershipSeed.initialStepIndex}
                  info="Official ASOSC membership helps sustain community programs year-round."
                  submitLabel="Submit"
                  successMessage="Thanks! Your membership application was received."
                  onSubmit={async (values) => {
                    await handleGenericSubmit(valuesToPayload(values));
                  }}
                  {...formGuards("Membership")}
                />
              )}

              {activeTitle === "Vendor" && (
                <GuidedForm
                  formKey={formInstanceKey}
                  steps={vendorSteps}
                  initialValues={vendorSeed.initialValues}
                  baselineValues={vendorSeed.baselineValues}
                  initialStepIndex={vendorSeed.initialStepIndex}
                  info="Register to sell food, crafts, or services at ASOSC events."
                  submitLabel="Submit Registration"
                  successMessage="Thanks! Your vendor registration was received."
                  onSubmit={async (values) => {
                    await handleGenericSubmit(valuesToPayload(values));
                  }}
                  {...formGuards("Vendor")}
                />
              )}

              {activeTitle === "Contact" && (
                <GuidedForm
                  formKey={formInstanceKey}
                  steps={contactSteps}
                  initialValues={contactSeed.initialValues}
                  baselineValues={contactSeed.baselineValues}
                  initialStepIndex={contactSeed.initialStepIndex}
                  info="Send a message to the ASOSC team — we typically reply within a few days."
                  submitLabel="Send Message"
                  successMessage="Thanks! Your message was sent."
                  onSubmit={async (values) => {
                    await handleGenericSubmit(valuesToPayload(values));
                  }}
                  {...formGuards("Contact")}
                />
              )}
                </>
              )}
            </div>

            {!formSucceeded && (
            <div className="flex shrink-0 justify-center px-5 pt-3 pb-[max(1.25rem,var(--safe-bottom))] md:px-8 md:pb-6 md:pt-5">
              <div className="flex w-full max-w-full items-center gap-2 md:gap-3">
                <button
                  type="button"
                  onClick={goToPreviousAction}
                  aria-label={
                    tabsLocked
                      ? "Unlock action tabs"
                      : "Previous community action"
                  }
                  className={`focus-ring-light flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-full bg-[#2a2a2a] text-(--orange) transition-opacity duration-200 hover:bg-[#343434] ${
                    tabsLocked ? "opacity-70" : ""
                  }`}
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>

                <div className="flex min-w-0 flex-1 justify-center">
                  <ExpandableTabs
                    tabs={actionTabs}
                    selected={activeActionIndex}
                    muted={tabsLocked}
                    onChange={(index) => {
                      if (index !== null) requestActionSwitch(index);
                    }}
                    className="max-w-full"
                  />
                </div>

                <button
                  type="button"
                  onClick={goToNextAction}
                  aria-label={
                    tabsLocked
                      ? "Unlock action tabs"
                      : "Next community action"
                  }
                  className={`focus-ring-light flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-full bg-[#2a2a2a] text-(--orange) transition-opacity duration-200 hover:bg-[#343434] ${
                    tabsLocked ? "opacity-70" : ""
                  }`}
                >
                  <ChevronRight className="h-5 w-5" />
                </button>
              </div>
            </div>
            )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
