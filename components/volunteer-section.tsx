"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import dynamic from "next/dynamic";
import { SectionLogoHeading } from "@/components/section-logo-heading";
import { EVENTS_PAGE_PATH } from "@/lib/events-nav";
import { cn } from "@/lib/utils";

// Not needed until a CTA is clicked — keep it out of this section's initial chunk.
const JoinCommunityModal = dynamic(
  () => import("@/components/join-community-modal").then((m) => m.JoinCommunityModal),
  { ssr: false },
);

const communityActions = [
  {
    id: "volunteer",
    heading: "Volunteer",
    eyebrow: "Get Involved",
    title: "Help Build Community With Us",
    body: "Share your time, skills, and energy at ASOSC events, programs, workshops, and community initiatives across Strathcona County.",
    button: "Volunteer With Us",
    action: "Volunteer",
  },
  {
    id: "donate",
    heading: "Donate",
    eyebrow: "Support The Work",
    title: "Invest In Programs That Serve Families",
    body: "Your contribution helps fund cultural celebrations, youth programming, wellness sessions, storytelling projects, and community outreach.",
    button: "Donate Today",
    action: "Donate",
  },
  {
    id: "events",
    heading: "Events",
    eyebrow: "Show Up & Celebrate",
    title: "Find Your Place At Our Next Gathering",
    body: "From the African Festival to Black History Month, wellness sessions, and youth programs — explore what's coming up across Strathcona County and take part.",
    button: "Get Involved",
    linkHref: EVENTS_PAGE_PATH,
    theme: "dark",
  },
  {
    id: "membership",
    heading: "Membership",
    eyebrow: "Join ASOSC",
    title: "Become Part Of The Society",
    body: "Membership helps strengthen our voice, grow our programs, and connect African families, allies, and partners.",
    button: "Become A Member",
    action: "Membership",
  },
  {
    id: "vendor",
    heading: "Vendor",
    eyebrow: "Partner With Us",
    title: "Register As A Vendor",
    body: "Showcase your business, art, craft and services at ASOSC's festivals and community events.",
    button: "Register",
    action: "Vendor",
    theme: "dark",
  },
  {
    id: "contact",
    heading: "Contact",
    eyebrow: "Reach Out",
    title: "Start A Conversation With Us",
    body: "Have a question, partnership idea, or community opportunity? Send us a message and we will connect with you.",
    button: "Contact Us",
    action: "Contact",
    theme: "dark",
  },
] as const;

type CommunityActionId = (typeof communityActions)[number]["id"];

interface CommunityActionSectionProps {
  actionId: CommunityActionId;
}

export function CommunityActionSection({ actionId }: CommunityActionSectionProps) {
  const [isJoinModalOpen, setIsJoinModalOpen] = useState(false);
  const [activeAction, setActiveAction] = useState<string | null>(null);
  const hasOpenedJoinModalRef = useRef(false);
  hasOpenedJoinModalRef.current ||= isJoinModalOpen;
  const item = communityActions.find((action) => action.id === actionId) ?? communityActions[0];
  const isDark = "theme" in item && item.theme === "dark";

  return (
    <>
      <section
        id={item.id}
        className={cn("section-shell", isDark ? "bg-black" : "bg-(--cream-light)")}
        aria-labelledby={`${item.id}-heading`}
      >
        <SectionLogoHeading
          id={`${item.id}-heading`}
        >
          {item.heading}
        </SectionLogoHeading>

        <div
          className={cn(
            "mx-auto max-w-3xl rounded-3xl px-6 py-8 text-center sm:px-10 sm:py-10",
            isDark
              ? "border border-(--cream-light)/15 bg-(--cream-light)/8"
              : "border border-(--brown-dark)/10 bg-(--cream)/60",
          )}
        >
          <span
            className={cn(
              "inline-block rounded-full px-4 py-1 text-sm font-bold uppercase tracking-wide",
              isDark ? "bg-(--hero-cta) text-black" : "bg-(--hero-cta)/20 text-black",
            )}
          >
            {item.eyebrow}
          </span>
          <h3
            className={cn(
              "mt-4 text-2xl font-bold sm:text-3xl",
              isDark ? "text-(--cream-light)" : "text-black",
            )}
          >
            {item.title}
          </h3>
          <p
            className={cn(
              "mx-auto mt-4 max-w-2xl text-lg leading-relaxed",
              isDark ? "text-(--cream)/85" : "text-black/80",
            )}
          >
            {item.body}
          </p>

          <div className="mt-8 flex justify-center">
            {"linkHref" in item && item.linkHref ? (
              <Link
                href={item.linkHref}
                className="hero-cta-btn focus-ring-light inline-flex min-h-14 cursor-pointer items-center justify-center px-10 py-4 text-base font-semibold tracking-wide text-black transition duration-200 ease-out"
              >
                {item.button}
              </Link>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setActiveAction("action" in item ? item.action : null);
                  setIsJoinModalOpen(true);
                }}
                className="hero-cta-btn focus-ring-light inline-flex min-h-14 cursor-pointer items-center justify-center px-10 py-4 text-base font-semibold tracking-wide text-black transition duration-200 ease-out"
              >
                {item.button}
              </button>
            )}
          </div>
        </div>
      </section>

      {hasOpenedJoinModalRef.current && (
        <JoinCommunityModal
          isOpen={isJoinModalOpen}
          onClose={() => setIsJoinModalOpen(false)}
          initialAction={activeAction}
        />
      )}
    </>
  );
}

export function VolunteerSection() {
  return <CommunityActionSection actionId="volunteer" />;
}
