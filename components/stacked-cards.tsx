"use client";

import Image from "next/image";
import { Children, useState, type ReactNode } from "react";
import {
  MediaPlaceholder,
  type MediaPlaceholderTone,
} from "@/components/media-placeholder";
import { cn } from "@/lib/utils";

const CARD_BACKGROUNDS = ["var(--hero-cta)", "var(--ink)"] as const;

export function StackedCardBody({
  imageSrc,
  imageAlt,
  children,
  mediaTone = "orange",
  priority = false,
}: {
  imageSrc: string;
  imageAlt: string;
  children: ReactNode;
  mediaTone?: MediaPlaceholderTone;
  /** Set for a card that renders above the fold (e.g. first card on /about)
   *  so its image is fetched eagerly instead of Next's lazy default. */
  priority?: boolean;
}) {
  const [imageLoaded, setImageLoaded] = useState(false);

  return (
    <div className="stacked-card__layout">
      <div className="stacked-card__content">{children}</div>
      <div className="stacked-card__media">
        <div className="stacked-card__media-frame">
          <MediaPlaceholder
            loaded={imageLoaded}
            tone={mediaTone}
            className="absolute inset-0"
          >
            <Image
              className={cn(
                "stacked-card__image transition-opacity duration-300 ease-out",
                !imageLoaded && "opacity-0",
              )}
              src={imageSrc}
              alt={imageAlt}
              fill
              unoptimized
              priority={priority}
              loading="eager"
              sizes="(max-width: 768px) 100vw, 420px"
              onLoad={() => setImageLoaded(true)}
            />
          </MediaPlaceholder>
        </div>
      </div>
    </div>
  );
}

/*
 * Every card is position: sticky (see .stacked-card-pin): each one pins
 * below the navbar in turn as the next card scrolls up to cover it, and the
 * browser releases all of them together once the container's bottom edge
 * (the last card's bottom) is reached — so they can never spill past the
 * last card or cover content below the section, at any viewport size.
 * `--first` only adds the top clearance below the section heading; it isn't
 * what makes a card sticky (see stacked-card-pin's base rule for that).
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
