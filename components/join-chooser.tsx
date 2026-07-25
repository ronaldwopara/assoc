"use client";

import { useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import {
  HandHeart,
  Heart,
  IdCard,
  Mail,
  MessageCircle,
  Store,
  type LucideIcon,
} from "lucide-react";
import { JOIN_ACTIONS } from "@/lib/join-actions";

// On-screen morph (panel → capsule): spring so a rapid re-toggle interrupts
// cleanly instead of snapping mid-bezier.
const MORPH_TRANSITION = { type: "spring", stiffness: 420, damping: 36, mass: 0.8 } as const;
const PRESS_FLASH_MS = 130;

const ACTION_ICONS: Record<string, LucideIcon> = {
  newsletter: Mail,
  volunteer: Heart,
  donate: HandHeart,
  membership: IdCard,
  vendor: Store,
  contact: MessageCircle,
};

interface JoinChooserProps {
  onSelect: (slug: string) => void;
}

export function JoinChooser({ onSelect }: JoinChooserProps) {
  const reduceMotion = useReducedMotion();
  const [pressedSlug, setPressedSlug] = useState<string | null>(null);
  const pendingRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (pendingRef.current !== null) window.clearTimeout(pendingRef.current);
    };
  }, []);

  const selectWithPress = (slug: string) => {
    if (pendingRef.current !== null) {
      window.clearTimeout(pendingRef.current);
    }
    if (reduceMotion) {
      onSelect(slug);
      return;
    }
    // Hold the press ring long enough to paint before the layout morph starts.
    setPressedSlug(slug);
    pendingRef.current = window.setTimeout(() => {
      pendingRef.current = null;
      onSelect(slug);
    }, PRESS_FLASH_MS);
  };

  return (
    <motion.div
      layoutId="join-shell"
      layout
      transition={MORPH_TRANSITION}
      className="join-chooser programs-panel"
      // borderRadius must live on style for Framer to interpolate it during morph.
      style={{ borderRadius: 16 }}
      role="group"
      aria-label="Choose how you'd like to get involved"
    >
      <ul className="m-0 grid list-none gap-2 p-2.5 sm:grid-cols-2">
        {JOIN_ACTIONS.map((action) => {
          const Icon = ACTION_ICONS[action.slug];
          const pressed = pressedSlug === action.slug;
          return (
            <li key={action.slug}>
              <button
                type="button"
                className="program-card focus-ring-light w-full text-left"
                data-pressed={pressed ? "true" : undefined}
                onClick={() => selectWithPress(action.slug)}
              >
                {Icon ? (
                  <Icon
                    className="join-chooser__icon mt-0.5 h-4 w-4 shrink-0"
                    aria-hidden
                  />
                ) : null}
                <div className="min-w-0 flex-1">
                  <div className="program-card__title">{action.title}</div>
                  <p className="program-card__desc">{action.description}</p>
                </div>
              </button>
            </li>
          );
        })}
      </ul>
    </motion.div>
  );
}
