"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { GalleryImage } from "@/lib/gallery-images";
import { MediaPlaceholder, useMediaLoaded } from "@/components/media-placeholder";
import { cn } from "@/lib/utils";

type GalleryLightboxProps = {
  images: GalleryImage[];
  index: number;
  onClose: () => void;
  onIndexChange: (index: number) => void;
};

const MIN_SCALE = 1;
const MAX_SCALE = 4;

// Keyed by src at the call site so every navigation remounts it: the skeleton
// resets to loading and the hook's ref reveals instantly if the next image is
// already cached (a same-element src swap can miss the load event).
function LightboxImage({ src, alt }: { src: string; alt: string }) {
  const { loaded, markLoaded, imgRef } = useMediaLoaded();

  return (
    <MediaPlaceholder loaded={loaded} tone="dark" className="relative max-h-full max-w-full">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        ref={imgRef}
        src={src}
        alt={alt}
        className={cn(
          "gallery-lightbox__image transition-opacity duration-300 ease-out",
          !loaded && "opacity-0",
        )}
        draggable={false}
        onLoad={markLoaded}
        onError={markLoaded}
      />
    </MediaPlaceholder>
  );
}

export function GalleryLightbox({
  images,
  index,
  onClose,
  onIndexChange,
}: GalleryLightboxProps) {
  const [mounted, setMounted] = useState(false);
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const imageWrapRef = useRef<HTMLDivElement>(null);
  const pointersRef = useRef<Map<number, { x: number; y: number }>>(new Map());
  const pinchRef = useRef<{ distance: number; scale: number } | null>(null);
  const dragRef = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);
  const scaleRef = useRef(scale);
  const offsetRef = useRef(offset);
  scaleRef.current = scale;
  offsetRef.current = offset;

  const count = images.length;
  const image = images[index];

  const resetZoom = useCallback(() => {
    setScale(1);
    setOffset({ x: 0, y: 0 });
  }, []);

  const goPrev = useCallback(() => {
    if (count < 2) return;
    onIndexChange((index - 1 + count) % count);
  }, [count, index, onIndexChange]);

  const goNext = useCallback(() => {
    if (count < 2) return;
    onIndexChange((index + 1) % count);
  }, [count, index, onIndexChange]);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    resetZoom();
  }, [index, resetZoom]);

  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
        return;
      }
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        goPrev();
      }
      if (event.key === "ArrowRight") {
        event.preventDefault();
        goNext();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [goNext, goPrev, onClose]);

  const clampOffset = useCallback((nextScale: number, x: number, y: number) => {
    const wrap = imageWrapRef.current;
    if (!wrap || nextScale <= 1) return { x: 0, y: 0 };
    const maxX = (wrap.clientWidth * (nextScale - 1)) / 2;
    const maxY = (wrap.clientHeight * (nextScale - 1)) / 2;
    return {
      x: Math.max(-maxX, Math.min(maxX, x)),
      y: Math.max(-maxY, Math.min(maxY, y)),
    };
  }, []);

  useEffect(() => {
    const wrap = imageWrapRef.current;
    if (!wrap) return;

    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const delta = -event.deltaY * 0.0015;
      const nextScale = Math.min(
        MAX_SCALE,
        Math.max(MIN_SCALE, scaleRef.current + delta * scaleRef.current),
      );
      setScale(nextScale);
      setOffset(clampOffset(nextScale, offsetRef.current.x, offsetRef.current.y));
    };

    wrap.addEventListener("wheel", onWheel, { passive: false });
    return () => wrap.removeEventListener("wheel", onWheel);
  }, [clampOffset, index]);

  const onPointerDown = (event: React.PointerEvent) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    pointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });

    if (pointersRef.current.size === 2) {
      const pts = [...pointersRef.current.values()];
      const distance = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      pinchRef.current = { distance, scale: scaleRef.current };
      dragRef.current = null;
      return;
    }

    if (scaleRef.current > 1) {
      dragRef.current = {
        x: event.clientX,
        y: event.clientY,
        ox: offsetRef.current.x,
        oy: offsetRef.current.y,
      };
    }
  };

  const onPointerMove = (event: React.PointerEvent) => {
    if (!pointersRef.current.has(event.pointerId)) return;
    pointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });

    if (pointersRef.current.size === 2 && pinchRef.current) {
      const pts = [...pointersRef.current.values()];
      const distance = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      const ratio = distance / Math.max(pinchRef.current.distance, 1);
      const nextScale = Math.min(
        MAX_SCALE,
        Math.max(MIN_SCALE, pinchRef.current.scale * ratio),
      );
      setScale(nextScale);
      setOffset(clampOffset(nextScale, offsetRef.current.x, offsetRef.current.y));
      return;
    }

    if (dragRef.current && scaleRef.current > 1) {
      const dx = event.clientX - dragRef.current.x;
      const dy = event.clientY - dragRef.current.y;
      setOffset(
        clampOffset(
          scaleRef.current,
          dragRef.current.ox + dx,
          dragRef.current.oy + dy,
        ),
      );
    }
  };

  const onPointerUp = (event: React.PointerEvent) => {
    pointersRef.current.delete(event.pointerId);
    if (pointersRef.current.size < 2) pinchRef.current = null;
    if (pointersRef.current.size === 0) dragRef.current = null;
  };

  const onBackdropClick = (event: React.MouseEvent) => {
    if (event.target === event.currentTarget) onClose();
  };

  if (!mounted || !image) return null;

  return createPortal(
    <div
      className="gallery-lightbox"
      role="dialog"
      aria-modal="true"
      aria-label="Gallery image viewer"
    >
      <button
        type="button"
        className="gallery-lightbox__close focus-ring-light"
        onClick={onClose}
        aria-label="Close image viewer"
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path
            d="M5 5l14 14M19 5L5 19"
            stroke="currentColor"
            strokeWidth="2.25"
            strokeLinecap="round"
          />
        </svg>
      </button>

      {count > 1 && (
        <>
          <button
            type="button"
            className="gallery-lightbox__nav gallery-lightbox__nav--prev focus-ring-light"
            onClick={goPrev}
            aria-label="Previous image"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path
                d="M15 5l-7 7 7 7"
                stroke="currentColor"
                strokeWidth="2.25"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
          <button
            type="button"
            className="gallery-lightbox__nav gallery-lightbox__nav--next focus-ring-light"
            onClick={goNext}
            aria-label="Next image"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path
                d="M9 5l7 7-7 7"
                stroke="currentColor"
                strokeWidth="2.25"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </>
      )}

      <div className="gallery-lightbox__stage" onClick={onBackdropClick}>
        <div
          ref={imageWrapRef}
          className="gallery-lightbox__image-wrap"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          style={{
            transform: `translate3d(${offset.x}px, ${offset.y}px, 0) scale(${scale})`,
            cursor: scale > 1 ? "grab" : "default",
          }}
        >
          <LightboxImage key={image.src} src={image.src} alt={image.alt} />
        </div>
      </div>
    </div>,
    document.body,
  );
}
