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
  getStaffFabPrefs,
  setStaffFabPrefs,
  DEFAULT_STAFF_FAB_PREFS,
  STAFF_FAB_CHANGE_EVENT,
  type StaffFabPrefs,
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
  const [fabPrefs, setFabPrefs] = useState<StaffFabPrefs>(DEFAULT_STAFF_FAB_PREFS);
  const pendingRef = useRef<number | null>(null);

  useEffect(() => {
    const sync = () => {
      setFabDisabled(isStaffFabHidden());
      setFabPrefs(getStaffFabPrefs());
    };
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
      {/* Keep above the tool list so it stays in the first mobile viewport. */}
      <div className="border-b border-white/15 px-3 py-3 flex flex-col gap-3">
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
            <span className="font-medium text-(--orange)">
              Disable floating settings button
            </span>
            <span className="mt-0.5 block text-xs text-white/60">
              Hides the orange tools shortcut on the public site. Turn this off
              anytime to bring it back.
            </span>
          </span>
        </label>

        {!fabDisabled && (
          <div className="ml-7 flex flex-col gap-3 border-l border-white/10 pl-3">
            <fieldset className="flex flex-col gap-1.5">
              <legend className="mb-0.5 text-xs font-medium text-white/85">
                Position
              </legend>
              <div className="flex gap-4 text-xs text-white/70">
                {(
                  [
                    { value: "bottom-left", label: "Bottom left" },
                    { value: "bottom-right", label: "Bottom right" },
                  ] as const
                ).map((opt) => (
                  <label key={opt.value} className="flex cursor-pointer items-center gap-1.5">
                    <input
                      type="radio"
                      name="fab-position"
                      className="h-3.5 w-3.5 accent-(--orange)"
                      checked={fabPrefs.position === opt.value}
                      onChange={() => {
                        const next = { ...fabPrefs, position: opt.value };
                        setFabPrefs(next);
                        setStaffFabPrefs({ position: opt.value });
                      }}
                    />
                    {opt.label}
                  </label>
                ))}
              </div>
            </fieldset>

            <fieldset className="flex flex-col gap-1.5">
              <legend className="mb-0.5 text-xs font-medium text-white/85">
                Show
              </legend>
              <div className="flex flex-col gap-1.5 text-xs text-white/70">
                {(
                  [
                    { value: "always", label: "Always visible" },
                    { value: "after-scroll", label: "After scrolling down" },
                  ] as const
                ).map((opt) => (
                  <label key={opt.value} className="flex cursor-pointer items-center gap-1.5">
                    <input
                      type="radio"
                      name="fab-trigger"
                      className="h-3.5 w-3.5 accent-(--orange)"
                      checked={fabPrefs.trigger === opt.value}
                      onChange={() => {
                        const next = { ...fabPrefs, trigger: opt.value };
                        setFabPrefs(next);
                        setStaffFabPrefs({ trigger: opt.value });
                      }}
                    />
                    {opt.label}
                  </label>
                ))}
              </div>
            </fieldset>

            {fabPrefs.trigger === "after-scroll" && (
              <label className="flex flex-col gap-1.5 text-xs text-white/70">
                <span>
                  Scroll distance:{" "}
                  <span className="font-medium text-white/85">
                    {fabPrefs.scrollThreshold}px
                  </span>
                </span>
                <input
                  type="range"
                  min={0}
                  max={2000}
                  step={50}
                  className="accent-(--orange)"
                  value={fabPrefs.scrollThreshold}
                  onChange={(event) => {
                    const next = { ...fabPrefs, scrollThreshold: Number(event.target.value) };
                    setFabPrefs(next);
                    setStaffFabPrefs({ scrollThreshold: next.scrollThreshold });
                  }}
                />
              </label>
            )}
          </div>
        )}
      </div>

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
    </motion.div>
  );
}
