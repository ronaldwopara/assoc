"use client";

import { useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * One question per screen, with a progress bar and Back / Next.
 * Used by every staff tool so they all feel the same.
 */

export type WizardStep = {
  key: string;
  title: string;
  hint?: string;
  /** Next stays disabled until this is true. Default true. */
  ready?: boolean;
  /** Next reads "Skip" while this is true (an optional step left empty). */
  skippable?: boolean;
  content: ReactNode;
};

export const WIZARD_INPUT =
  "w-full rounded-xl border border-(--ink)/15 bg-white px-4 py-3 text-base text-(--ink) outline-none focus:border-(--orange)";

export function StepWizard({
  steps,
  label,
  onCancel,
  onFinish,
  finishLabel = "Done",
  finishing,
  busy,
  status,
  className,
  hideFinish,
}: {
  steps: WizardStep[];
  /** Small text top right, e.g. "New program". */
  label?: string;
  onCancel?: () => void;
  onFinish: () => void;
  finishLabel?: string;
  finishing?: boolean;
  /** Blocks moving while an upload runs. */
  busy?: boolean;
  status?: { type: "idle" | "ok" | "error"; message: string };
  className?: string;
  /** The last step has its own action (e.g. Send), so no footer button. */
  hideFinish?: boolean;
}) {
  const [index, setIndex] = useState(0);
  const [dir, setDir] = useState(1);
  const i = Math.min(index, steps.length - 1);
  const step = steps[i];
  const last = i === steps.length - 1;
  const ready = step.ready ?? true;

  const go = (to: number) => {
    setDir(to > i ? 1 : -1);
    setIndex(to);
  };

  return (
    <div className={cn("mx-auto w-full max-w-xl", className)}>
      <div className="flex items-center justify-between gap-3">
        {onCancel ? (
          <button
            type="button"
            onClick={onCancel}
            className="cursor-pointer text-sm font-medium text-(--ink)/60 underline underline-offset-2 hover:text-(--ink)"
          >
            Cancel
          </button>
        ) : (
          <span />
        )}
        <p className="text-sm text-(--ink)/50">
          {label ? `${label} · ` : ""}
          {i + 1} of {steps.length}
        </p>
      </div>
      <div className="mt-3 flex gap-1.5" aria-hidden>
        {steps.map((s, n) => (
          <span key={s.key} className={cn("h-1.5 flex-1 rounded-full transition-colors", n <= i ? "bg-(--orange)" : "bg-(--ink)/10")} />
        ))}
      </div>

      <div className="relative mt-8 min-h-56">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={step.key}
            initial={{ opacity: 0, x: dir * 24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: dir * -24 }}
            transition={{ duration: 0.18 }}
          >
            <h2 className="text-2xl font-semibold text-balance text-(--ink)">{step.title}</h2>
            {step.hint && <p className="mt-1 text-sm text-(--ink)/55">{step.hint}</p>}
            <div
              className="mt-5"
              onKeyDown={(e) => {
                if (e.key !== "Enter" || e.target instanceof HTMLTextAreaElement) return;
                if (!(e.target instanceof HTMLInputElement)) return;
                e.preventDefault();
                if (!ready || busy || (last && hideFinish)) return;
                if (last) onFinish();
                else go(i + 1);
              }}
            >
              {step.content}
            </div>
          </motion.div>
        </AnimatePresence>
      </div>

      {status?.message && (
        <p className={cn("mt-4 text-sm", status.type === "error" ? "text-red-700" : "text-emerald-800")} role="status">
          {status.message}
        </p>
      )}

      <div className="mt-8 flex items-center justify-between gap-3">
        {i > 0 ? (
          <button
            type="button"
            className="inline-flex min-h-12 cursor-pointer items-center justify-center rounded-lg px-4 text-base font-medium text-(--ink)/70 hover:bg-(--ink)/5 disabled:opacity-40"
            onClick={() => go(i - 1)}
            disabled={busy || finishing}
          >
            Back
          </button>
        ) : (
          <span />
        )}
        {!(last && hideFinish) && <button
          type="button"
          className="hero-cta-btn inline-flex min-h-12 cursor-pointer items-center justify-center gap-2 px-8 text-base font-semibold text-black disabled:cursor-not-allowed disabled:opacity-40"
          disabled={!ready || busy || finishing}
          onClick={() => (last ? onFinish() : go(i + 1))}
        >
          {last ? (
            <>
              {finishing ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Check className="size-4" aria-hidden />}
              {finishLabel}
            </>
          ) : step.skippable ? (
            "Skip"
          ) : (
            "Next"
          )}
        </button>}
      </div>
    </div>
  );
}

/** A big tappable choice row (radio). */
export function WizardOption({
  title,
  sub,
  selected,
  onSelect,
}: {
  title: ReactNode;
  sub?: ReactNode;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      className={cn(
        "flex w-full cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 text-left transition-colors",
        selected ? "border-(--orange) bg-(--orange)/10" : "border-(--ink)/15 bg-white hover:bg-(--cream-light)",
      )}
    >
      <span
        className={cn(
          "flex size-5 shrink-0 items-center justify-center rounded-full border-2",
          selected ? "border-(--orange) bg-(--orange)" : "border-(--ink)/30",
        )}
        aria-hidden
      >
        {selected && <span className="size-1.5 rounded-full bg-black" />}
      </span>
      <span className="min-w-0 flex-1 truncate text-base font-medium text-(--ink)">{title}</span>
      {sub && <span className="shrink-0 text-sm text-(--ink)/50">{sub}</span>}
    </button>
  );
}

export function WizardChoices({ children }: { children: ReactNode }) {
  return (
    <div role="radiogroup" className="space-y-2">
      {children}
    </div>
  );
}

/** Shown after a single-screen tool saves: a short summary and a way back in. */
export function WizardDone({ title, children, onAgain, againLabel = "Change it" }: { title: string; children?: ReactNode; onAgain: () => void; againLabel?: string }) {
  return (
    <div className="mx-auto w-full max-w-xl rounded-2xl bg-white/70 p-6 text-center">
      <span className="mx-auto grid size-12 place-items-center rounded-full bg-emerald-100 text-emerald-700">
        <Check className="size-6" aria-hidden />
      </span>
      <h2 className="mt-4 text-xl font-semibold text-(--ink)">{title}</h2>
      {children && <div className="mt-2 text-sm text-(--ink)/65">{children}</div>}
      <button
        type="button"
        onClick={onAgain}
        className="mt-6 inline-flex min-h-11 cursor-pointer items-center justify-center rounded-lg border border-(--ink)/20 bg-white px-5 text-sm font-semibold text-(--ink) hover:bg-(--cream-light)"
      >
        {againLabel}
      </button>
    </div>
  );
}
