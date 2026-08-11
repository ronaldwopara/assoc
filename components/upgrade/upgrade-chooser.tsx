"use client";

import { useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import {
  AppWindow,
  BarChart3,
  FileText,
  Images,
  Megaphone,
  type LucideIcon,
} from "lucide-react";
import { UPGRADE_TOOLS, type UpgradeToolId } from "@/lib/upgrade-tools";
import {
  isStaffFabHidden,
  setStaffFabHidden,
  STAFF_FAB_CHANGE_EVENT,
} from "@/lib/staff-fab";

const MORPH_TRANSITION = { type: "spring", stiffness: 420, damping: 36, mass: 0.8 } as const;
const PRESS_FLASH_MS = 130;

const TOOL_ICONS: Record<UpgradeToolId, LucideIcon> = {
  dashboard: BarChart3,
  gallery: Images,
  announcement: Megaphone,
  documents: FileText,
  popup: AppWindow,
};

interface UpgradeChooserProps {
  onSelectTool: (tool: UpgradeToolId) => void;
}

export function UpgradeChooser({ onSelectTool }: UpgradeChooserProps) {
  const reduceMotion = useReducedMotion();
  const [pressedId, setPressedId] = useState<string | null>(null);
  const [fabDisabled, setFabDisabled] = useState(false);
  const pendingRef = useRef<number | null>(null);

  useEffect(() => {
    const sync = () => setFabDisabled(isStaffFabHidden());
    sync();
    window.addEventListener(STAFF_FAB_CHANGE_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(STAFF_FAB_CHANGE_EVENT, sync);
      window.removeEventListener("storage", sync);
      if (pendingRef.current !== null) window.clearTimeout(pendingRef.current);
    };
  }, []);

  const selectWithPress = (id: string, action: () => void) => {
    if (pendingRef.current !== null) {
      window.clearTimeout(pendingRef.current);
    }
    if (reduceMotion) {
      action();
      return;
    }
    setPressedId(id);
    pendingRef.current = window.setTimeout(() => {
      pendingRef.current = null;
      action();
    }, PRESS_FLASH_MS);
  };

  return (
    <motion.div
      layoutId="upgrade-shell"
      layout
      transition={MORPH_TRANSITION}
      className="join-chooser programs-panel"
      style={{ borderRadius: 16 }}
      role="group"
      aria-label="Choose an upgrade tool"
    >
      <ul className="m-0 grid list-none gap-2 p-2.5 sm:grid-cols-2">
        {UPGRADE_TOOLS.map((tool) => {
          const Icon = TOOL_ICONS[tool.id];
          const pressed = pressedId === tool.id;
          return (
            <li key={tool.id}>
              <button
                type="button"
                className="program-card focus-ring-light w-full text-left"
                data-pressed={pressed ? "true" : undefined}
                onClick={() =>
                  selectWithPress(tool.id, () => onSelectTool(tool.id))
                }
              >
                {Icon ? (
                  <Icon
                    className="join-chooser__icon mt-0.5 h-4 w-4 shrink-0"
                    aria-hidden
                  />
                ) : null}
                <div className="min-w-0 flex-1">
                  <div className="program-card__title">{tool.title}</div>
                  <p className="program-card__desc">{tool.description}</p>
                </div>
              </button>
            </li>
          );
        })}
      </ul>

      <div className="border-t border-white/15 px-3 py-3">
        <label className="flex cursor-pointer items-start gap-3 text-sm text-white/85">
          <input
            type="checkbox"
            className="mt-0.5 h-4 w-4 shrink-0 accent-(--orange)"
            checked={fabDisabled}
            onChange={(event) => {
              const next = event.target.checked;
              setFabDisabled(next);
              setStaffFabHidden(next);
            }}
          />
          <span>
            <span className="font-medium text-white">
              Disable floating settings button
            </span>
            <span className="mt-0.5 block text-xs text-white/60">
              Hides the orange tools shortcut on the public site. Turn this off
              anytime to bring it back.
            </span>
          </span>
        </label>
      </div>
    </motion.div>
  );
}
