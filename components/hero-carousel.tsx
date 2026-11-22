"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { MediaPlaceholder } from "@/components/media-placeholder";
import { cn } from "@/lib/utils";
import { useSiteContent } from "@/components/site-content-provider";
import type { Slide } from "@/lib/site-content/types";


const SLIDE_DURATION = 5550;

// The indicator row stays at a fixed 3 dots regardless of how many photos
// are in SLIDES — the active dot cycles through all 3 positions as slides
// advance, so it moves on every transition.
const DOT_COUNT = 3;

function HeroSlide({
  slide,
  index,
  isActive,
  tick,
}: {
  slide: Slide;
  index: number;
  isActive: boolean;
  tick: number;
}) {
  const [loaded, setLoaded] = useState(false);

  return (
    <div className="hero-carousel-slide" data-active={isActive}>
      <MediaPlaceholder loaded={loaded} tone="ink" className="absolute inset-0">
        <Image
          key={isActive ? `active-${tick}` : `idle-${index}`}
          src={slide.src}
          alt={slide.alt}
          fill
          priority={index === 0}
          loading="eager"
          unoptimized
          sizes="100vw"
          className={cn(
            "hero-carousel-image transition-opacity duration-300 ease-out",
            !loaded && "opacity-0",
          )}
          onLoad={() => setLoaded(true)}
        />
      </MediaPlaceholder>
    </div>
  );
}

export function HeroCarousel() {
  const SLIDES = useSiteContent().hero.slides.filter((s) => s.src);
  const [active, setActive] = useState(0);
  const [tick, setTick] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const id = setTimeout(() => {
      setActive((i) => (i + 1) % Math.max(SLIDES.length, 1));
      setTick((t) => t + 1);
    }, SLIDE_DURATION);

    return () => clearTimeout(id);
  }, [active, paused, SLIDES.length]);

  return (
    <div
      className="hero-carousel"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      role="group"
      aria-roledescription="carousel"
      aria-label="Photos of ASOSC community events"
    >
      {SLIDES.map((slide, index) => (
        <HeroSlide
          key={slide.src}
          slide={slide}
          index={index}
          isActive={index === active}
          tick={tick}
        />
      ))}

      <div className="hero-carousel-overlay" aria-hidden />
      <div className="hero-carousel-grain" aria-hidden />

      <div className="hero-carousel-dots">
        {Array.from({ length: DOT_COUNT }, (_, dotIndex) => (
          <button
            key={dotIndex}
            type="button"
            className="hero-carousel-dot"
            data-active={active % DOT_COUNT === dotIndex}
            aria-label={`Show photo ${dotIndex + 1}`}
            aria-current={active % DOT_COUNT === dotIndex}
            onClick={() => {
              setActive(dotIndex);
              setTick((t) => t + 1);
            }}
          />
        ))}
      </div>
    </div>
  );
}
