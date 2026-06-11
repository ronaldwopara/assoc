"use client";

import { useRef } from "react";
import { HeroCarousel } from "./hero-carousel";
import { HeroContent } from "./hero-content";

export function HeroSection() {
  const containerRef = useRef<HTMLElement>(null);

  return (
    <section
      ref={containerRef}
      id="home"
      className="relative z-10 mt-(--navbar-height) h-[160vh]"
      aria-label="Welcome"
    >
      <div className="sticky top-(--navbar-height) h-[calc(100dvh-var(--navbar-height))] overflow-hidden">
        <HeroCarousel />
        <HeroContent containerRef={containerRef} />
      </div>
    </section>
  );
}
