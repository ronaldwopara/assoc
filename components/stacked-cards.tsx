"use client";

import { Children, useLayoutEffect, useRef, type ReactNode } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

const CARD_BACKGROUNDS = ["var(--hero-cta)", "#000000"] as const;

function getNavbarHeightPx() {
  const root = document.documentElement;
  const nav = getComputedStyle(root).getPropertyValue("--navbar-height").trim();
  const rem = parseFloat(getComputedStyle(root).fontSize);
  return nav.endsWith("rem") ? parseFloat(nav) * rem : parseFloat(nav);
}

export function StackedCardBody({
  videoSrc,
  videoLabel,
  children,
}: {
  videoSrc: string;
  videoLabel: string;
  children: ReactNode;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useLayoutEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          void video.play().catch(() => {});
        } else {
          video.pause();
        }
      },
      { threshold: 0.35 },
    );

    observer.observe(video);
    return () => observer.disconnect();
  }, [videoSrc]);

  return (
    <div className="stacked-card__layout">
      <div className="stacked-card__content">{children}</div>
      <div className="stacked-card__media">
        <div className="stacked-card__media-frame">
          <video
            ref={videoRef}
            className="stacked-card__video"
            src={videoSrc}
            aria-label={videoLabel}
            muted
            loop
            playsInline
            preload="metadata"
          />
        </div>
      </div>
    </div>
  );
}

export function StackedCards({ children }: { children: ReactNode }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const pinsRef = useRef<(HTMLDivElement | null)[]>([]);
  const items = Children.toArray(children);

  useLayoutEffect(() => {
    const container = containerRef.current;
    const pins = pinsRef.current.filter(Boolean) as HTMLDivElement[];
    if (!container || pins.length < 2) return;

    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    if (prefersReducedMotion) return;

    const navHeight = getNavbarHeightPx();

    const ctx = gsap.context(() => {
      ScrollTrigger.create({
        trigger: pins[0],
        start: `top top+=${navHeight}`,
        endTrigger: pins[1],
        end: `bottom bottom-=${navHeight}`,
        pin: true,
        pinSpacing: false,
        invalidateOnRefresh: true,
      });
    }, container);

    const handleResize = () => ScrollTrigger.refresh();
    window.addEventListener("resize", handleResize);
    const refreshTimer = setTimeout(() => ScrollTrigger.refresh(), 100);

    return () => {
      window.removeEventListener("resize", handleResize);
      clearTimeout(refreshTimer);
      ctx.revert();
    };
  }, [items.length]);

  return (
    <div
      ref={containerRef}
      id="module-home-features-cards_container"
      className="stacked-cards-container"
    >
      {items.map((child, i) => (
        <div
          key={i}
          id={`module-home-features-card_${i + 1}`}
          ref={(el) => {
            pinsRef.current[i] = el;
          }}
          className={`stacked-card-pin${i === 0 ? " stacked-card-pin--first" : ""}`}
          style={{ zIndex: i + 1 }}
        >
          <div
            className="stacked-card"
            style={{ backgroundColor: CARD_BACKGROUNDS[i] ?? CARD_BACKGROUNDS[0] }}
          >
            {child}
          </div>
        </div>
      ))}
    </div>
  );
}
