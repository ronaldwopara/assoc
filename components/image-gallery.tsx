"use client";

import React from "react";
import { useInView } from "framer-motion";
import { GALLERY_CATEGORIES } from "@/lib/gallery-categories";
import { getGalleryImagesForSelection } from "@/lib/gallery-images";
import { cn } from "@/lib/utils";

const AFRICAN_FESTIVAL_ALBUM_URL =
  "https://photos.google.com/share/AF1QipOaBC6eQJKD5QwabSndsk2rRqCPcTcy60-8y4N8CP4g_PoddgYvciUBdmcurYxdEg?key=TTdyUllMTm9qNW9ObWYxMGUzbDhuWFFucVdIZC1B";
const BLACK_HISTORY_MONTH_ALBUM_URL =
  "https://photos.google.com/share/AF1QipMFMS-3m6HBsbaC__yDGCUTPjoJyk_PQDFSO1bt6SAWuGWVDxYj_wnlEQ_iKsjCog?key=Sk9yTTMtbzB6UFNzUjBnbFAzTzN0MFlJSENycFVn";
const AFRICAN_SUMMER_BBQ_2023_ALBUM_URL =
  "https://photos.google.com/share/AF1QipMg2THI6p5J7B1M4hShpd1gMBVubIXZRlNybzw46N6jUpJsqpfkt8_V6jbYeAn5lg?key=UlMtVVQ2enZGMXZRRnJ1amZkSFVYUjJteG51MTlR";
const GALLERY_ALBUM_URLS: Partial<Record<string, string>> = {
  "african-festival": AFRICAN_FESTIVAL_ALBUM_URL,
  "black-history-month": BLACK_HISTORY_MONTH_ALBUM_URL,
  "african-summer-bbq": AFRICAN_SUMMER_BBQ_2023_ALBUM_URL,
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

interface ImageGalleryProps {
  program: string;
  year: string;
}

export function ImageGallery({ program, year }: ImageGalleryProps) {
  const images = getGalleryImagesForSelection(program, year);
  const columnCount = useColumnCount();
  const [isExpanded, setIsExpanded] = React.useState(false);
  const categoryLabel =
    GALLERY_CATEGORIES.find((item) => item.slug === program)?.program ?? "Gallery";

  React.useEffect(() => {
    setIsExpanded(false);
  }, [program, year]);

  const columns = React.useMemo(
    () => distributeIntoColumns(images, columnCount),
    [images, columnCount],
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
      <div className="gallery-bento-frame">
        <div
          className={cn("gallery-bento", !isExpanded && "gallery-bento--collapsed")}
        >
          {columns.map((column, columnIndex) => (
            <div key={columnIndex} className="gallery-bento__column">
              {column.map((image) => (
                <AnimatedImage
                  key={`${program}-${year}-${image.src}`}
                  alt={image.alt}
                  src={image.src}
                  ratio={image.ratio}
                />
              ))}
            </div>
          ))}
        </div>
      </div>

      {!isExpanded && (
        <div className="gallery-bento__cta-wrap">
          {GALLERY_ALBUM_URLS[program] ? (
            <a
              href={GALLERY_ALBUM_URLS[program]}
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
    </div>
  );
}

interface AnimatedImageProps {
  alt: string;
  src: string;
  ratio: number;
}

function AnimatedImage({ alt, src, ratio }: AnimatedImageProps) {
  const ref = React.useRef(null);
  const isInView = useInView(ref, { once: true });
  const [isLoaded, setIsLoaded] = React.useState(false);
  const [hasError, setHasError] = React.useState(false);

  return (
    <div ref={ref} className="gallery-bento__item" style={{ aspectRatio: ratio }}>
      <div
        className={cn("gallery-bento__placeholder", {
          "opacity-0": isLoaded && !hasError,
        })}
        aria-hidden
      />
      {!hasError && (
        <img
          alt={alt}
          src={src}
          className={cn("gallery-bento__image opacity-0 transition-opacity duration-300 ease-out", {
            "opacity-100": isInView && isLoaded,
          })}
          onLoad={() => setIsLoaded(true)}
          loading="lazy"
          onError={() => setHasError(true)}
        />
      )}
    </div>
  );
}
