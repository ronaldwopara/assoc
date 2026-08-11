"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Settings } from "lucide-react";
import {
  isStaffFabHidden,
  STAFF_FAB_CHANGE_EVENT,
} from "@/lib/staff-fab";

/**
 * Bottom-left staff shortcut. Visible when the shared upgrade/dashboard
 * session is active and the user hasn't disabled it from the tool picker.
 */
export function StaffToolsFab() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [authed, setAuthed] = useState(false);
  const [hidden, setHidden] = useState(true);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const syncHidden = () => setHidden(isStaffFabHidden());
    syncHidden();

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

    window.addEventListener(STAFF_FAB_CHANGE_EVENT, syncHidden);
    window.addEventListener("storage", syncHidden);
    return () => {
      cancelled = true;
      window.removeEventListener(STAFF_FAB_CHANGE_EVENT, syncHidden);
      window.removeEventListener("storage", syncHidden);
    };
  }, [pathname]);

  // Hide only while inside an active tool — every tool view has its own
  // "All tools"/back control there, so the fab is redundant (and on mobile
  // it can overlap in-tool overlays like modals). Still show it on the tool
  // picker hub itself (/upgrade with no tool selected) and everywhere else.
  const insideActiveTool = pathname === "/upgrade" && !!searchParams.get("tool");

  if (!ready || !authed || hidden || insideActiveTool) return null;

  return (
    <button
      type="button"
      className="staff-tools-fab focus-ring-light"
      aria-label="Open staff tools"
      title="Staff tools"
      onClick={() => router.push("/upgrade")}
    >
      <Settings className="staff-tools-fab__icon" aria-hidden strokeWidth={2} />
    </button>
  );
}
