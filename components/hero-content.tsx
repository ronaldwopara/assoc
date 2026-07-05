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

const primaryCtaClassName =
  "hero-cta-btn hero-cta-btn--primary focus-ring-light flex min-h-14 cursor-pointer items-center justify-center px-10 py-4 text-base font-semibold tracking-wide transition duration-200 ease-out";

const secondaryCtaClassName =
  "hero-cta-btn hero-cta-btn--ghost focus-ring flex min-h-14 cursor-pointer items-center justify-center px-10 py-4 text-base font-semibold tracking-wide transition duration-200 ease-out";

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
    <div className="hero-content pointer-events-none absolute inset-0 z-10 flex flex-col items-start px-6 text-left text-white sm:px-16 lg:px-24 xl:px-32">
      <div className="hero-copy pointer-events-auto w-full max-w-4xl">
        <h1 className="hero-headline flex flex-wrap gap-x-3 select-none text-[clamp(2rem,6vw,4.25rem)] font-bold uppercase leading-[1.1] tracking-wide drop-shadow-[0_1px_8px_rgba(0,0,0,0.45)]">
          {WORDS.map((word) => (
            <span key={word}>{word}</span>
          ))}
        </h1>

        <div
          className="hero-subheadline mt-5 max-w-[42rem] select-none text-lg font-medium leading-relaxed text-white sm:mt-6 sm:text-xl sm:font-semibold"
          role="doc-subtitle"
        >
          {SUBHEADLINE}
        </div>
      </div>

      <div className="hero-cta-row pointer-events-auto w-full">
        <button
          ref={ctaRef}
          type="button"
          onClick={() => setIsJoinModalOpen(true)}
          className={primaryCtaClassName}
        >
          Join Our Community
        </button>

        <a href="#programs" className={secondaryCtaClassName}>
          Explore Our Programs
        </a>
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
