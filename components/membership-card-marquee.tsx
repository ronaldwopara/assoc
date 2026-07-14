"use client";

import { useEffect, useState } from "react";
import { MembershipCard } from "@/components/membership-card";
import { membershipCategoryOptions } from "@/lib/join-community-forms";
import { DRAFTS_CHANGED_EVENT, readSavedMemberName } from "@/lib/join-community-drafts";

type MembershipCardMarqueeProps = {
  onSelect: (categoryValue: string) => void;
};

export function MembershipCardMarquee({ onSelect }: MembershipCardMarqueeProps) {
  const [memberName, setMemberName] = useState("");

  useEffect(() => {
    const sync = () => setMemberName(readSavedMemberName());
    sync();
    window.addEventListener(DRAFTS_CHANGED_EVENT, sync);
    return () => window.removeEventListener(DRAFTS_CHANGED_EVENT, sync);
  }, []);

  // Track is duplicated once so the -50% translate loops seamlessly.
  const loop = [...membershipCategoryOptions, ...membershipCategoryOptions];

  return (
    <div className="mcard-marquee" aria-label="Membership categories">
      <div className="mcard-marquee__track">
        {loop.map((option, index) => {
          const isDuplicate = index >= membershipCategoryOptions.length;
          return (
            <button
              key={`${option.value}-${index}`}
              type="button"
              className="mcard-marquee__item focus-ring-light"
              onClick={() => onSelect(option.value)}
              aria-label={`Become a member — ${option.title} (${option.price})`}
              aria-hidden={isDuplicate || undefined}
              tabIndex={isDuplicate ? -1 : undefined}
            >
              <MembershipCard
                categoryTitle={option.title}
                price={option.price}
                memberName={memberName || undefined}
              />
            </button>
          );
        })}
      </div>
    </div>
  );
}
