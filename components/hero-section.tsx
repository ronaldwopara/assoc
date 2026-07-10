"use client";

import { HeroCarousel } from "./hero-carousel";
import { HeroContent } from "./hero-content";

export function HeroSection() {
  return (
    <section
      id="home"
      className="hero-section relative z-10 mt-(--header-height) h-[calc(100dvh-var(--header-height))] overflow-hidden"
      aria-label="Welcome"
    >
      <HeroCarousel />
      <HeroContent />
    </section>
  );
}
