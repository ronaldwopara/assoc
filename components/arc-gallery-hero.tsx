"use client";

import { useEffect, useState } from "react";
import { JoinCommunityModal } from "@/components/join-community-modal";

interface ArcGalleryHeroProps {
  images: string[];
  startAngle?: number;
  endAngle?: number;
  radiusLg?: number;
  radiusMd?: number;
  radiusSm?: number;
  cardSizeLg?: number;
  cardSizeMd?: number;
  cardSizeSm?: number;
}

const ROTATION_SPEED_DEG_PER_SEC = 5;
const FADE_BUFFER_DEG = 15;

function normalizeAngle(angle: number) {
  return ((angle % 360) + 360) % 360;
}

function round(value: number) {
  return Math.round(value * 100) / 100;
}

export function ArcGalleryHero({
  images,
  startAngle = 15,
  endAngle = 165,
  radiusLg = 500,
  radiusMd = 380,
  radiusSm = 240,
  cardSizeLg = 180,
  cardSizeMd = 150,
  cardSizeSm = 110,
}: ArcGalleryHeroProps) {
  const [dimensions, setDimensions] = useState({
    radius: radiusLg,
    cardSize: cardSizeLg,
  });
  const [rotation, setRotation] = useState(0);
  const [isJoinModalOpen, setIsJoinModalOpen] = useState(false);

  useEffect(() => {
    const handleResize = () => {
      const width = window.innerWidth;
      if (width < 640) {
        setDimensions({ radius: radiusSm, cardSize: cardSizeSm });
      } else if (width < 1024) {
        setDimensions({ radius: radiusMd, cardSize: cardSizeMd });
      } else {
        setDimensions({ radius: radiusLg, cardSize: cardSizeLg });
      }
    };

    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [radiusLg, radiusMd, radiusSm, cardSizeLg, cardSizeMd, cardSizeSm]);

  useEffect(() => {
    if (images.length === 0) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let raf: number;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = now - last;
      last = now;
      setRotation((prev) => prev + (dt / 1000) * ROTATION_SPEED_DEG_PER_SEC);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [images.length]);

  if (images.length === 0) return null;

  const step = 360 / images.length;

  return (
    <section
      id="gallery"
      className="section-shell relative overflow-hidden bg-black"
      aria-labelledby="gallery-heading"
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_20%,rgba(240,143,59,0.16),transparent_38%)]" />
      <div
        className="relative z-10 mx-auto w-full"
        style={{ height: dimensions.radius + dimensions.cardSize }}
      >
        <div className="arc-gallery__pivot absolute bottom-0 left-1/2 -translate-x-1/2">
          {images.map((src, i) => {
            const angle = normalizeAngle(i * step + rotation);
            const angleRad = (angle * Math.PI) / 180;
            const x = round(Math.cos(angleRad) * dimensions.radius);
            const y = round(Math.sin(angleRad) * dimensions.radius);

            let opacity = 0;
            if (angle >= startAngle && angle <= endAngle) {
              opacity = 1;
            } else if (angle < startAngle && angle >= startAngle - FADE_BUFFER_DEG) {
              opacity = (angle - (startAngle - FADE_BUFFER_DEG)) / FADE_BUFFER_DEG;
            } else if (angle > endAngle && angle <= endAngle + FADE_BUFFER_DEG) {
              opacity = (endAngle + FADE_BUFFER_DEG - angle) / FADE_BUFFER_DEG;
            }

            if (opacity <= 0) return null;

            const scale = round(0.82 + 0.18 * opacity);

            return (
              <div
                key={src}
                className="absolute"
                style={{
                  width: dimensions.cardSize,
                  height: dimensions.cardSize,
                  left: `calc(50% + ${x}px)`,
                  bottom: `${y}px`,
                  transform: `translate(-50%, 50%) scale(${scale})`,
                  opacity: round(opacity),
                  zIndex: Math.round(opacity * 100),
                }}
              >
                <div
                  className="h-full w-full overflow-hidden rounded-2xl bg-black shadow-xl shadow-black/35 ring-1 ring-(--cream-light)/20"
                  style={{ transform: `rotate(${round(angle / 4)}deg)` }}
                >
                  <img
                    src={src}
                    alt=""
                    className="block h-full w-full object-cover"
                    draggable={false}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="relative z-20 mx-auto -mt-32 max-w-2xl px-6 text-center sm:-mt-40 lg:-mt-48">
        <h2
          id="gallery-heading"
          className="section-heading"
          style={{ fontSize: "clamp(2.75rem, 6vw, 4.25rem)" }}
        >
          Gallery
        </h2>
        <p
          className="mx-auto mt-6 max-w-2xl text-lg font-semibold leading-relaxed"
          style={{ color: "var(--orange)" }}
        >
          Event photos and community highlights from our festivals, workshops,
          and gatherings.
        </p>
        <div className="mt-8 flex justify-center">
          <button
            type="button"
            onClick={() => setIsJoinModalOpen(true)}
            className="hero-cta-btn focus-ring-light inline-flex min-h-14 cursor-pointer items-center justify-center px-10 py-4 text-base font-semibold tracking-wide text-black transition duration-200 ease-out"
          >
            View Gallery
          </button>
        </div>
      </div>

      <JoinCommunityModal
        isOpen={isJoinModalOpen}
        onClose={() => setIsJoinModalOpen(false)}
      />
    </section>
  );
}
