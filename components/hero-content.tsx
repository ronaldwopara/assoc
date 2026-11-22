"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { useSiteContent } from "@/components/site-content-provider";

const primaryCtaClassName =
  "hero-cta-btn hero-cta-btn--primary focus-ring-light flex min-h-14 cursor-pointer items-center justify-center px-10 py-4 text-base font-semibold tracking-wide transition duration-200 ease-out";

const secondaryCtaClassName =
  "hero-cta-btn hero-cta-btn--ghost focus-ring flex min-h-14 cursor-pointer items-center justify-center px-10 py-4 text-base font-semibold tracking-wide transition duration-200 ease-out";

export function HeroContent() {
  const { hero } = useSiteContent();
  const words = hero.headline.split(/\s+/).filter(Boolean);
  const ctaRef = useRef<HTMLAnchorElement>(null);

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
          {words.map((word, i) => (
            <span key={`${word}-${i}`}>{word}</span>
          ))}
        </h1>

        <div
          className="hero-subheadline mt-5 max-w-[42rem] select-none text-lg font-medium leading-relaxed text-white sm:mt-6 sm:text-xl sm:font-semibold"
          role="doc-subtitle"
        >
          {hero.subheadline}
        </div>
      </div>

      <div className="hero-cta-row pointer-events-auto w-full">
        <Link ref={ctaRef} href="/join" className={primaryCtaClassName}>
          {hero.primaryButton}
        </Link>

        <a href="#programs" className={secondaryCtaClassName}>
          {hero.secondaryButton}
        </a>
      </div>
    </div>
  );
}
