"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AnimatePresence, LayoutGroup, motion, useReducedMotion } from "framer-motion";
import { JoinChooser } from "@/components/join-chooser";
import { JoinControls } from "@/components/join-controls";
import { JoinFormPanel } from "@/components/join-form-panel";
import { PageBackLink } from "@/components/page-back-link";
import { SectionLogoHeading } from "@/components/section-logo-heading";
import type { FormValues } from "@/components/guided-form";
import {
  clearFormDraft,
  readFormDrafts,
  upsertFormDraft,
  writeFormDrafts,
  type FormDraft,
  type FormDraftMap,
} from "@/lib/join-community-drafts";
import {
  isValidJoinActionSlug,
  isValidMembershipCategory,
  joinActionHref,
  JOIN_SUCCESS_MESSAGES,
} from "@/lib/join-actions";

// Morph is on-screen layout change → ease-in-out feel via spring (interruptible).
// Form enter is a separate ease-out after the shell settles.
const FORM_ENTER = {
  duration: 0.24,
  ease: [0.165, 0.84, 0.44, 1] as const,
  delay: 0.1,
};

function scrollJoinToTop() {
  // html { scroll-behavior: smooth } can override scrollTo's behavior option in
  // some browsers — force an instant jump for picker ↔ form transitions.
  const root = document.documentElement;
  const previous = root.style.scrollBehavior;
  root.style.scrollBehavior = "auto";
  window.scrollTo(0, 0);
  root.style.scrollBehavior = previous;
}

export function JoinPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const reduceMotion = useReducedMotion();

  const rawAction = searchParams.get("action");
  const actionSlug = isValidJoinActionSlug(rawAction) ? rawAction : null;
  const rawCategory = searchParams.get("category");
  const membershipCategory = isValidMembershipCategory(rawCategory) ? rawCategory : null;
  const contactMessage = searchParams.get("message");

  // A valid ?action= deep-links straight past the chooser, same as
  // /gallery?program=… — but once chosen (from either the URL or the
  // chooser), stay chosen even if the slug becomes invalid mid-session.
  const [hasChosen, setHasChosen] = useState(() => actionSlug !== null);

  const [drafts, setDrafts] = useState<FormDraftMap>({});
  // GuidedForm only re-hydrates its internal state when its formKey changes
  // (see guided-form.tsx's [formKey]-gated effect) — on first mount that
  // effect fires before this component's own drafts-loading effect (child
  // effects run before parent effects), so if the form panel rendered
  // immediately it would hydrate from an empty draft and never pick up the
  // real one once drafts arrive a tick later. Hold it unmounted until drafts
  // are loaded, same as the old modal's `mounted` gate.
  const [draftsReady, setDraftsReady] = useState(false);
  const [formDirty, setFormDirty] = useState(false);
  const [sessionKey, setSessionKey] = useState(0);
  const [formSucceeded, setFormSucceeded] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [successValues, setSuccessValues] = useState<FormValues | null>(null);

  const activeSlug = actionSlug ?? "newsletter";

  useEffect(() => {
    setDrafts(readFormDrafts());
    setDraftsReady(true);
  }, []);

  useEffect(() => {
    if (!formDirty) return;
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [formDirty]);

  const resetFormState = () => {
    setFormDirty(false);
    setFormSucceeded(false);
    setSuccessMessage("");
    setSuccessValues(null);
    setSessionKey((key) => key + 1);
  };

  const commitSwitch = (nextSlug: string) => {
    // Picker sits mid-page after the heading — jump up so the control bar
    // and form start under the header instead of leaving the viewport mid-chooser.
    if (!hasChosen) scrollJoinToTop();
    router.replace(joinActionHref(nextSlug), { scroll: false });
    setHasChosen(true);
    resetFormState();
  };

  const requestActionSwitch = (nextSlug: string) => {
    if (nextSlug === activeSlug) return;
    commitSwitch(nextSlug);
  };

  const requestReopen = () => {
    // Scroll first so collapsing the tall form can't overscroll and flash the footer.
    scrollJoinToTop();
    setHasChosen(false);
    router.replace("/join", { scroll: false });
  };

  const handleDirtyChange = (dirty: boolean, source: "hydrate" | "edit") => {
    setFormDirty(dirty);
    if (source === "hydrate") return;

    if (dirty) return;

    setDrafts((current) => {
      if (!(activeSlug in current)) return current;
      const next = clearFormDraft(current, activeSlug);
      writeFormDrafts(next);
      return next;
    });
  };

  const handleDraftChange = (draft: FormDraft, source: "hydrate" | "edit") => {
    setDrafts((current) => {
      const next = upsertFormDraft(current, activeSlug, draft);
      writeFormDrafts(next);
      return next;
    });
  };

  const handleFormCompleted = () => {
    setDrafts((current) => {
      if (!(activeSlug in current)) return current;
      const next = clearFormDraft(current, activeSlug);
      writeFormDrafts(next);
      return next;
    });
    setFormDirty(false);
  };

  const handleFormSuccessChange = (success: boolean, values?: FormValues) => {
    setFormSucceeded(success);
    if (success) {
      setSuccessMessage(JOIN_SUCCESS_MESSAGES[activeSlug] ?? "Sent.");
      setSuccessValues(values ?? null);
    }
  };

  return (
    <div className="join-page mx-auto w-full max-w-5xl px-4 pt-2 sm:pt-3">
      <PageBackLink className="mb-2 sm:mb-3" />

      {!hasChosen && (
        <div className="mx-auto max-w-5xl px-1 pb-6 text-center sm:px-2 sm:pb-8">
          <SectionLogoHeading id="join-page-heading" as="h1">
            Join Our Community
          </SectionLogoHeading>
          <p
            className="mx-auto mt-3 max-w-md text-base font-semibold leading-relaxed sm:mt-6 sm:max-w-2xl sm:text-lg"
            style={{ color: "var(--orange)" }}
          >
            Subscribe to our newsletter, volunteer, donate, become a member,
            register as a vendor, or get in touch with ASOSC.
          </p>
        </div>
      )}

      {/* LayoutGroup only around the shell — wrapping the form made Framer
          remeasure it during the capsule↔panel morph and jitter the footer. */}
      <LayoutGroup id="join-shell-group">
        <div className="join-page__picker">
          <AnimatePresence initial={false}>
            {!hasChosen ? (
              <JoinChooser key="chooser" onSelect={commitSwitch} />
            ) : (
              !formSucceeded && (
                <JoinControls
                  key="controls"
                  actionSlug={activeSlug}
                  onGoTo={requestActionSwitch}
                  onReopen={requestReopen}
                />
              )
            )}
          </AnimatePresence>
        </div>
      </LayoutGroup>

      {/* No exit animation: fading the tall panel out while remounting the
          heading left the footer overscrolled, then clamped with a flash. */}
      {hasChosen && draftsReady && (
        <motion.div
          key={`panel-${activeSlug}-${sessionKey}`}
          className="join-page__panel"
          initial={reduceMotion ? false : { opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={reduceMotion ? { duration: 0 } : FORM_ENTER}
        >
          <JoinFormPanel
            actionSlug={activeSlug}
            sessionKey={sessionKey}
            drafts={drafts}
            initialMembershipCategory={membershipCategory}
            initialContactMessage={contactMessage}
            formSucceeded={formSucceeded}
            successMessage={successMessage}
            successValues={successValues}
            onDirtyChange={handleDirtyChange}
            onDraftChange={handleDraftChange}
            onCompleted={handleFormCompleted}
            onSuccessChange={handleFormSuccessChange}
          />
        </motion.div>
      )}
    </div>
  );
}
