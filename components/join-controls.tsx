"use client";

import { motion } from "framer-motion";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { JOIN_ACTIONS, getJoinActionIndex } from "@/lib/join-actions";

// On-screen morph (capsule ↔ panel): spring so a rapid re-toggle interrupts
// cleanly instead of snapping mid-bezier.
const MORPH_TRANSITION = { type: "spring", stiffness: 420, damping: 36, mass: 0.8 } as const;

interface JoinControlsProps {
  actionSlug: string;
  onGoTo: (slug: string) => void;
  onReopen: () => void;
}

export function JoinControls({ actionSlug, onGoTo, onReopen }: JoinControlsProps) {
  const index = getJoinActionIndex(actionSlug);
  const action = JOIN_ACTIONS[index];

  const goTo = (direction: -1 | 1) => {
    const nextIndex = (index + direction + JOIN_ACTIONS.length) % JOIN_ACTIONS.length;
    onGoTo(JOIN_ACTIONS[nextIndex].slug);
  };

  return (
    <motion.div
      layoutId="join-shell"
      layout
      transition={MORPH_TRANSITION}
      className="join-controls"
      // borderRadius must live on style for Framer to interpolate it during morph.
      style={{ borderRadius: 9999 }}
      role="group"
      aria-label="Join action"
    >
      <button
        type="button"
        aria-label="Previous action"
        className="join-controls__nav-button focus-ring-light"
        onClick={() => goTo(-1)}
      >
        <ChevronLeft className="join-controls__nav-icon" aria-hidden />
      </button>

      <button
        type="button"
        className="join-controls__label focus-ring-light"
        title={action.title}
        aria-label={`${action.title} — choose a different action`}
        onClick={onReopen}
      >
        {action.title}
      </button>

      <button
        type="button"
        aria-label="Next action"
        className="join-controls__nav-button focus-ring-light"
        onClick={() => goTo(1)}
      >
        <ChevronRight className="join-controls__nav-icon" aria-hidden />
      </button>
    </motion.div>
  );
}
