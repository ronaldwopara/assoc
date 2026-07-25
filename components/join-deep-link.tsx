"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { legacyJoinParamToSlug, joinActionHref } from "@/lib/join-actions";

/**
 * Maps a legacy `/?join=<value>` query param to the new `/join?action=<slug>`
 * page — e.g. the old WordPress vendor sign-up page redirects to
 * /?join=vendor and should land the visitor on the Vendor form there.
 */
export function JoinDeepLink() {
  const router = useRouter();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const raw = params.get("join");
    if (!raw) return;

    const slug = legacyJoinParamToSlug(raw);
    if (!slug) return;

    router.replace(joinActionHref(slug));
  }, [router]);

  return null;
}
