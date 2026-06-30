"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";

// Not needed until a CTA is clicked — keep it out of the hero's initial chunk.
const JoinCommunityModal = dynamic(
  () => import("./join-community-modal").then((m) => m.JoinCommunityModal),
  { ssr: false },
);

const HEADLINE = "AFRICANS SOCIETY OF STRATHCONA COUNTY";
const WORDS = HEADLINE.split(" ");

const SUBHEADLINE =
  "Empowering Africans to enrich the social, economic, and cultural fabric of Strathcona County and beyond";

const ctaClassName =
  "hero-cta-btn focus-ring-light inline-flex min-h-14 cursor-pointer items-center justify-center px-10 py-4 text-base font-semibold tracking-wide text-black transition duration-200 ease-out";

export function HeroContent() {
  const [isJoinModalOpen, setIsJoinModalOpen] = useState(false);
  const ctaRef = useRef<HTMLButtonElement>(null);
  const hasOpenedJoinModalRef = useRef(false);
  hasOpenedJoinModalRef.current ||= isJoinModalOpen;

  useEffect(() => {
    const el = ctaRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        const past = !entry.isIntersecting && entry.boundingClientRect.bottom < 0;
        window.dispatchEvent(new CustomEvent("heroCtaPastView", { detail: { past } }));
      },
      { threshold: 0 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div className="pointer-events-none absolute inset-0 z-10 flex flex-col items-start justify-center px-6 text-left text-white sm:px-16 lg:px-24 xl:px-32">
      <div className="pointer-events-auto max-w-4xl">
        <h1 className="hero-headline mt--30 flex flex-wrap gap-x-3 select-none text-[clamp(2rem,6vw,4.25rem)] font-bold uppercase leading-[1.1] tracking-wide drop-shadow-[0_1px_8px_rgba(0,0,0,0.45)]">

          {WORDS.map((word) => (
            <span key={word}>{word}</span>
          ))}
        </h1>

        <div
          className="hero-subheadline mt-6 max-w-[42rem] select-none text-lg font-normal leading-relaxed text-white/95 sm:text-xl"
          role="doc-subtitle"
        >
          {SUBHEADLINE}
        </div>

        <div className="hero-cta-row mt-20 flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-center">
          <button
            ref={ctaRef}
            type="button"
            onClick={() => setIsJoinModalOpen(true)}
            className={ctaClassName}
          >
            Join Our Community
          </button>

          <a href="#programs" className={ctaClassName}>
            Explore Our Programs
          </a>
        </div>
      </div>

      {hasOpenedJoinModalRef.current && (
        <JoinCommunityModal
          isOpen={isJoinModalOpen}
          onClose={() => setIsJoinModalOpen(false)}
        />
      )}
    </div>
  );
}
