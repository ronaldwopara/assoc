"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Settings } from "lucide-react";
import {
  isStaffFabHidden,
  getStaffFabPrefs,
  DEFAULT_STAFF_FAB_PREFS,
  STAFF_FAB_CHANGE_EVENT,
  type StaffFabPrefs,
} from "@/lib/staff-fab";

/**
 * Bottom staff shortcut. Visible when the shared upgrade/dashboard session
 * is active and the user hasn't disabled it from the tool picker. Position
 * and scroll-triggered reveal are configurable from that same picker.
 */
export function StaffToolsFab() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [authed, setAuthed] = useState(false);
  const [hidden, setHidden] = useState(true);
  const [ready, setReady] = useState(false);
  const [prefs, setPrefs] = useState<StaffFabPrefs>(DEFAULT_STAFF_FAB_PREFS);
  const [pastScrollThreshold, setPastScrollThreshold] = useState(false);

  useEffect(() => {
    const sync = () => {
      setHidden(isStaffFabHidden());
      setPrefs(getStaffFabPrefs());
    };
    sync();

    let cancelled = false;
    fetch("/api/upgrade/session", { credentials: "same-origin", cache: "no-store" })
      .then(async (res) => {
        if (cancelled) return;
        if (!res.ok) {
          setAuthed(false);
          return;
        }
        // Require an explicit JSON flag — a soft redirect HTML 200 must not count.
        try {
          const body = (await res.json()) as { authenticated?: unknown };
          setAuthed(body.authenticated === true);
        } catch {
          setAuthed(false);
        }
      })
      .catch(() => {
        if (!cancelled) setAuthed(false);
      })
      .finally(() => {
        if (!cancelled) setReady(true);
      });

    window.addEventListener(STAFF_FAB_CHANGE_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      cancelled = true;
      window.removeEventListener(STAFF_FAB_CHANGE_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, [pathname]);

  // Scroll-triggered reveal: only tracked while that mode is active, and
  // re-checked immediately on every prefs change (e.g. threshold edited
  // while already scrolled past the old one).
  useEffect(() => {
    if (prefs.trigger !== "after-scroll") {
      setPastScrollThreshold(false);
      return;
    }
    const check = () => setPastScrollThreshold(window.scrollY >= prefs.scrollThreshold);
    check();
    window.addEventListener("scroll", check, { passive: true });
    return () => window.removeEventListener("scroll", check);
  }, [prefs.trigger, prefs.scrollThreshold]);

  // Hide only while inside an active tool — every tool view has its own
  // "All tools"/back control there, so the fab is redundant (and on mobile
  // it can overlap in-tool overlays like modals). Still show it on the tool
  // picker hub itself (/upgrade with no tool selected) and everywhere else.
  const insideActiveTool = pathname === "/upgrade" && !!searchParams.get("tool");
  const scrollGateOpen = prefs.trigger === "always" || pastScrollThreshold;

  if (!ready || !authed || hidden || insideActiveTool || !scrollGateOpen) return null;

  return (
    <button
      type="button"
      className={`staff-tools-fab staff-tools-fab--${prefs.position} focus-ring-light`}
      aria-label="Open staff tools"
      title="Staff tools"
      onClick={() => router.push("/upgrade")}
    >
      <Settings className="staff-tools-fab__icon" aria-hidden strokeWidth={2} />
    </button>
  );
}
