"use client";

import { Children, useLayoutEffect, useRef, type ReactNode } from "react";

const CARD_BACKGROUNDS = ["var(--hero-cta)", "#000000"] as const;

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

/*
 * The first card is position: sticky (see .stacked-card-pin--first): it pins
 * below the navbar while the next card scrolls up over it, and the browser
 * releases it once its bottom edge reaches the container's bottom edge — so
 * it can never spill past the last card or cover content below the section,
 * at any viewport size.
 */
export function StackedCards({ children }: { children: ReactNode }) {
  const items = Children.toArray(children);

  return (
    <div
      id="module-home-features-cards_container"
      className="stacked-cards-container"
    >
      {items.map((child, i) => (
        <div
          key={i}
          id={`module-home-features-card_${i + 1}`}
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
