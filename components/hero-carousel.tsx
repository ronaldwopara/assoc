"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

const SLIDES = [
  { src: "/caurosel/1-c.webp", alt: "Community members gathered together at an ASOSC event" },
  { src: "/caurosel/2-c.webp", alt: "Group portrait celebrating in vibrant traditional attire" },
  { src: "/caurosel/3-c.webp", alt: "Friends posing together in colourful festival dress" },
  { src: "/caurosel/4-c.webp", alt: "A large community gathering in the park" },
  { src: "/caurosel/5-c.webp", alt: "Friends posing together on the grass at a summer event" },
  { src: "/caurosel/6-c.webp", alt: "Children with painted faces enjoying a community picnic" },
];

const SLIDE_DURATION = 5550;

// The indicator row stays at a fixed 3 dots regardless of how many photos
// are in SLIDES — the active dot cycles through all 3 positions as slides
// advance, so it moves on every transition.
const DOT_COUNT = 3;

export function HeroCarousel() {
  const [active, setActive] = useState(0);
  const [tick, setTick] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const id = setTimeout(() => {
      setActive((i) => (i + 1) % SLIDES.length);
      setTick((t) => t + 1);
    }, SLIDE_DURATION);

    return () => clearTimeout(id);
  }, [active, paused]);

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
        <div key={slide.src} className="hero-carousel-slide" data-active={index === active}>
          <Image
            key={index === active ? `active-${tick}` : `idle-${index}`}
            src={slide.src}
            alt={slide.alt}
            fill
            priority={index === 0}
            unoptimized
            sizes="100vw"
            className="hero-carousel-image"
            onLoad={() => {
              if (index === 0) {
                (window as typeof window & { __heroReady?: boolean }).__heroReady = true;
                window.dispatchEvent(new Event("heroReady"));
              }
            }}
          />
        </div>
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
