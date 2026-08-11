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
    fetch("/api/upgrade/session", { credentials: "same-origin" })
      .then((res) => {
        if (!cancelled) setAuthed(res.ok);
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

  // Hide only on the tool-picker hub — you're already there.
  const onToolPickerHub = pathname === "/upgrade" && !searchParams.get("tool");

  if (!ready || !authed || hidden || onToolPickerHub) return null;

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
