"use client";

import React from "react";
import { useInView } from "framer-motion";
import { GalleryLightbox } from "@/components/gallery-lightbox";
import { GALLERY_CATEGORIES } from "@/lib/gallery-categories";
import { getGalleryImagesForSelection, type GalleryImage } from "@/lib/gallery-images";
import { cn } from "@/lib/utils";

const AFRICAN_FESTIVAL_ALBUM_URL =
  "https://photos.google.com/share/AF1QipMjTmDXrlT0oB55zdjvAP4nRnuDFGv3Sd1v7uRyZZCdsDEKbBbpvarV79JolyPNQQ?key=QVZOZTMxWUVCdXRNVWVIUFFmZGlPd2tjdUFiVDh3";
const BLACK_HISTORY_MONTH_ALBUM_URL =
  "https://photos.google.com/share/AF1QipMFMS-3m6HBsbaC__yDGCUTPjoJyk_PQDFSO1bt6SAWuGWVDxYj_wnlEQ_iKsjCog?key=Sk9yTTMtbzB6UFNzUjBnbFAzTzN0MFlJSENycFVn";
const AFRICAN_SUMMER_BBQ_2023_ALBUM_URL =
  "https://photos.google.com/share/AF1QipMg2THI6p5J7B1M4hShpd1gMBVubIXZRlNybzw46N6jUpJsqpfkt8_V6jbYeAn5lg?key=UlMtVVQ2enZGMXZRRnJ1amZkSFVYUjJteG51MTlR";
const AFRICAN_SUMMER_BBQ_2022_ALBUM_URL =
  "https://photos.google.com/share/AF1QipPF8q3MlrmlSfFzT8D3Q3nh0wto6RphKudDzhcgqJVarRWU4kp4vLH751QsA-lDGw?key=UUE2elVFZlFwakxiMnkxMXJ6YmhQS0haSWhicUxR";
const GALLERY_ALBUM_URLS: Partial<Record<string, string>> = {
  "african-festival": AFRICAN_FESTIVAL_ALBUM_URL,
  "black-history-month": BLACK_HISTORY_MONTH_ALBUM_URL,
  "african-summer-bbq:2023": AFRICAN_SUMMER_BBQ_2023_ALBUM_URL,
  "african-summer-bbq:2022": AFRICAN_SUMMER_BBQ_2022_ALBUM_URL,
};
const LANDSCAPE_RATIO = 16 / 9;
const PORTRAIT_RATIO = 9 / 16;
const PLACEHOLDER_RATIOS = [
  LANDSCAPE_RATIO,
  PORTRAIT_RATIO,
  LANDSCAPE_RATIO,
  PORTRAIT_RATIO,
  LANDSCAPE_RATIO,
  PORTRAIT_RATIO,
];

function useColumnCount() {
  const [count, setCount] = React.useState(2);

  React.useEffect(() => {
    const mq = window.matchMedia("(min-width: 640px)");
    const update = () => setCount(mq.matches ? 3 : 2);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  return count;
}

/** Greedy shortest-column-first placement so every program gets the same balanced bento feel. */
function distributeIntoColumns<T extends { ratio: number }>(
  items: T[],
  columnCount: number,
): T[][] {
  const columns: T[][] = Array.from({ length: columnCount }, () => []);
  const heights = new Array(columnCount).fill(0);

  for (const item of items) {
    let shortest = 0;
    for (let i = 1; i < columnCount; i++) {
      if (heights[i] < heights[shortest]) shortest = i;
    }
    columns[shortest].push(item);
    heights[shortest] += 1 / item.ratio;
  }

  return columns;
}

/** True when the tile sits in the solid (non-faded) part of the collapsed preview. */
function isInCollapsedPreview(itemEl: HTMLElement, frameEl: HTMLElement) {
  const frameRect = frameEl.getBoundingClientRect();
  const itemRect = itemEl.getBoundingClientRect();
  const solidBottom = frameRect.top + frameRect.height * 0.62;
  return itemRect.top < solidBottom;
}

interface ImageGalleryProps {
  program: string;
  year: string;
}

export function ImageGallery({ program, year }: ImageGalleryProps) {
  const images = getGalleryImagesForSelection(program, year);
  const albumUrl = GALLERY_ALBUM_URLS[`${program}:${year}`] ?? GALLERY_ALBUM_URLS[program];
  const columnCount = useColumnCount();
  const [isExpanded, setIsExpanded] = React.useState(false);
  const [lightboxIndex, setLightboxIndex] = React.useState<number | null>(null);
  const frameRef = React.useRef<HTMLDivElement>(null);
  const categoryLabel =
    GALLERY_CATEGORIES.find((item) => item.slug === program)?.program ?? "Gallery";

  React.useEffect(() => {
    setIsExpanded(false);
    setLightboxIndex(null);
  }, [program, year]);

  const columns = React.useMemo(
    () => distributeIntoColumns(images, columnCount),
    [images, columnCount],
  );

  const openLightbox = React.useCallback((image: GalleryImage) => {
    const index = images.findIndex((item) => item.src === image.src);
    if (index >= 0) setLightboxIndex(index);
  }, [images]);

  const handleImageActivate = React.useCallback(
    (image: GalleryImage, itemEl: HTMLElement) => {
      const frameEl = frameRef.current;
      const blockedByCollapse = !isExpanded && frameEl && !isInCollapsedPreview(itemEl, frameEl);

      if (blockedByCollapse) {
        if (albumUrl) {
          window.open(albumUrl, "_blank", "noopener,noreferrer");
          return;
        }
        setIsExpanded(true);
        return;
      }

      openLightbox(image);
    },
    [albumUrl, isExpanded, openLightbox],
  );

  if (images.length === 0) {
    const placeholderColumns = distributeIntoColumns(
      PLACEHOLDER_RATIOS.map((ratio, index) => ({ ratio, key: index })),
      columnCount,
    );

    return (
      <div className="gallery-bento-frame pb-8 pt-4 sm:pb-10">
        <div className="gallery-bento">
          {placeholderColumns.map((column, columnIndex) => (
            <div key={columnIndex} className="gallery-bento__column">
              {column.map((item) => (
                <div
                  key={item.key}
                  className="gallery-bento__item"
                  style={{ aspectRatio: item.ratio }}
                >
                  <div className="gallery-bento__placeholder" aria-hidden />
                </div>
              ))}
            </div>
          ))}
        </div>

        <div className="gallery-bento__empty-overlay">
          <p className="gallery-bento__empty-title font-semibold text-(--orange)">
            No photos for {categoryLabel} ({year}) yet.
          </p>
          <p className="gallery-bento__empty-subtitle text-(--ink)/70">
            Check back soon — new galleries are added after each event.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="pb-8 pt-4 sm:pb-10">
      <div ref={frameRef} className="gallery-bento-frame">
        <div
          className={cn("gallery-bento", !isExpanded && "gallery-bento--collapsed")}
        >
          {columns.map((column, columnIndex) => (
            <div key={columnIndex} className="gallery-bento__column">
              {column.map((image) => (
                <AnimatedImage
                  key={`${program}-${year}-${image.src}`}
                  image={image}
                  onActivate={handleImageActivate}
                />
              ))}
            </div>
          ))}
        </div>
      </div>

      {!isExpanded && (
        <div className="gallery-bento__cta-wrap">
          {albumUrl ? (
            <a
              href={albumUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="hero-cta-btn focus-ring-light inline-flex min-h-12 cursor-pointer items-center justify-center px-10 py-3 text-sm font-semibold tracking-wide text-black transition duration-200 ease-out"
            >
              View More
            </a>
          ) : (
            <button
              type="button"
              className="hero-cta-btn focus-ring-light inline-flex min-h-12 cursor-pointer items-center justify-center px-10 py-3 text-sm font-semibold tracking-wide text-black transition duration-200 ease-out"
              onClick={() => setIsExpanded(true)}
            >
              View More
            </button>
          )}
        </div>
      )}

      {lightboxIndex !== null && (
        <GalleryLightbox
          images={images}
          index={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
          onIndexChange={setLightboxIndex}
        />
      )}
    </div>
  );
}

interface AnimatedImageProps {
  image: GalleryImage;
  onActivate: (image: GalleryImage, itemEl: HTMLElement) => void;
}

function AnimatedImage({ image, onActivate }: AnimatedImageProps) {
  const ref = React.useRef<HTMLButtonElement>(null);
  const isInView = useInView(ref, { once: true });
  const [isLoaded, setIsLoaded] = React.useState(false);
  const [hasError, setHasError] = React.useState(false);

  return (
    <button
      ref={ref}
      type="button"
      className="gallery-bento__item gallery-bento__item--interactive"
      style={{ aspectRatio: image.ratio }}
      onClick={() => {
        if (ref.current) onActivate(image, ref.current);
      }}
      aria-label={`View ${image.alt}`}
    >
      <div
        className={cn("gallery-bento__placeholder", {
          "opacity-0": isLoaded && !hasError,
        })}
        aria-hidden
      />
      {!hasError && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          alt=""
          src={image.src}
          className={cn("gallery-bento__image opacity-0 transition-opacity duration-300 ease-out", {
            "opacity-100": isInView && isLoaded,
          })}
          onLoad={() => setIsLoaded(true)}
          loading="lazy"
          onError={() => setHasError(true)}
        />
      )}
    </button>
  );
}
