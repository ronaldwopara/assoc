"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";

const JoinCommunityModal = dynamic(
  () => import("@/components/join-community-modal").then((m) => m.JoinCommunityModal),
  { ssr: false },
);

// Maps a ?join=<value> query param to a Join Community modal tab, so migrated
// links can open a specific form directly — e.g. the old WordPress vendor
// sign-up page redirects to /?join=vendor and lands the visitor on the Vendor
// form. Values are matched case-insensitively; unknown values are ignored.
const JOIN_ACTIONS: Record<string, string> = {
  newsletter: "Newsletter",
  volunteer: "Volunteer",
  donate: "Donate",
  membership: "Membership",
  vendor: "Vendor",
  contact: "Contact",
};

export function JoinDeepLink() {
  const [action, setAction] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const raw = params.get("join");
    if (!raw) return;

    const mapped = JOIN_ACTIONS[raw.trim().toLowerCase()];
    if (!mapped) return;

    setAction(mapped);

    // Strip ?join from the address bar so a refresh / share / back-nav doesn't
    // reopen the modal, without triggering a navigation.
    params.delete("join");
    const query = params.toString();
    const cleaned =
      window.location.pathname + (query ? `?${query}` : "") + window.location.hash;
    window.history.replaceState(null, "", cleaned);

    setOpen(true);
  }, []);

  if (!action) return null;

  return (
    <JoinCommunityModal
      isOpen={open}
      onClose={() => setOpen(false)}
      initialAction={action}
    />
  );
}
