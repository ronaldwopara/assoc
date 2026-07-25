import { membershipCategoryOptions } from "@/lib/join-community-forms";

export type JoinAction = {
  slug: string;
  title: string;
  description: string;
};

export const JOIN_ACTIONS: JoinAction[] = [
  {
    slug: "newsletter",
    title: "Newsletter",
    description: "Stay updated on events, programs, and community news.",
  },
  {
    slug: "volunteer",
    title: "Volunteer",
    description: "Help build community at festivals, workshops, and gatherings.",
  },
  {
    slug: "donate",
    title: "Donate",
    description: "Support programs that serve African families in Strathcona County.",
  },
  {
    slug: "membership",
    title: "Membership",
    description: "Become part of the society and help sustain the work year-round.",
  },
  {
    slug: "vendor",
    title: "Vendor",
    description: "Register to sell or showcase at ASOSC events.",
  },
  {
    slug: "contact",
    title: "Contact",
    description: "Reach out with questions, ideas, or partnership interest.",
  },
];

export function isValidJoinActionSlug(slug: string | null): slug is string {
  if (!slug) return false;
  return JOIN_ACTIONS.some((item) => item.slug === slug);
}

export function joinActionFromSlug(slug: string | null): JoinAction | null {
  if (!slug || !isValidJoinActionSlug(slug)) return null;
  return JOIN_ACTIONS.find((item) => item.slug === slug) ?? null;
}

export function getJoinActionIndex(slug: string): number {
  const index = JOIN_ACTIONS.findIndex((item) => item.slug === slug);
  return index >= 0 ? index : 0;
}

/** Shared by join-page-content (owns the success banner state) and
 *  join-form-panel (renders the matching GuidedForm's successMessage prop). */
export const JOIN_SUCCESS_MESSAGES: Record<string, string> = {
  newsletter: "Thanks! You're on the newsletter list.",
  volunteer: "Thanks for volunteering with ASOSC!",
  donate: "Thank you for your generous donation!",
  membership: "Thanks! Your membership application was received.",
  vendor: "Thanks! Your vendor registration was received.",
  contact: "Thanks! Your message was sent.",
};

export function joinActionHref(slug: string, extraParams?: Record<string, string>): string {
  const params = new URLSearchParams({ action: slug, ...extraParams });
  return `/join?${params.toString()}`;
}

export function isValidMembershipCategory(value: string | null): value is string {
  if (!value) return false;
  return membershipCategoryOptions.some((option) => option.value === value);
}

/**
 * Maps the legacy `/?join=<value>` query param (old WordPress redirects) to
 * the new `/join?action=<slug>` slug. Values already match 1:1 today, but
 * this stays a lookup (not a passthrough) so a future rename on one side
 * doesn't silently break the other, and unknown/typo'd values are rejected.
 */
const LEGACY_JOIN_PARAM_TO_SLUG: Record<string, string> = {
  newsletter: "newsletter",
  volunteer: "volunteer",
  donate: "donate",
  membership: "membership",
  vendor: "vendor",
  contact: "contact",
};

export function legacyJoinParamToSlug(raw: string | null): string | null {
  if (!raw) return null;
  const slug = LEGACY_JOIN_PARAM_TO_SLUG[raw.trim().toLowerCase()];
  return slug && isValidJoinActionSlug(slug) ? slug : null;
}
