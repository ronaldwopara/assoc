"use client";

import React from "react";
import { useInView } from "framer-motion";
import { GalleryLightbox } from "@/components/gallery-lightbox";
import { useGalleryCms } from "@/components/gallery-cms-provider";
import {
  cmsToCategories,
  getAlbumUrl,
  getImagesForSelection,
} from "@/lib/gallery-cms/helpers";
import type { GalleryImage } from "@/lib/gallery-images";
import { MediaPlaceholder } from "@/components/media-placeholder";
import { cn } from "@/lib/utils";

/** Collapsed preview always shows a neat 2×3 landscape grid (matches gallery reference). */
const PREVIEW_TILE_COUNT = 6;

interface ImageGalleryProps {
  program: string;
  year: string;
}

export function ImageGallery({ program, year }: ImageGalleryProps) {
  const cms = useGalleryCms();
  const images = getImagesForSelection(cms, program, year);
  const albumUrl = getAlbumUrl(cms, program, year);
  const [isExpanded, setIsExpanded] = React.useState(false);
  const [lightboxIndex, setLightboxIndex] = React.useState<number | null>(null);
  const categoryLabel =
    cmsToCategories(cms).find((item) => item.slug === program)?.program ??
    "Gallery";

  React.useEffect(() => {
    setIsExpanded(false);
    setLightboxIndex(null);
  }, [program, year]);

  const visibleImages = isExpanded ? images : images.slice(0, PREVIEW_TILE_COUNT);
  const showViewMore = !isExpanded && images.length > 0;
  const bentoCountClass = images.length === 3 ? "gallery-bento--count-3" : undefined;

  const openLightbox = React.useCallback(
    (image: GalleryImage) => {
      const index = images.findIndex((item) => item.src === image.src);
      if (index >= 0) setLightboxIndex(index);
    },
    [images],
  );

  const handleImageActivate = React.useCallback(
    (image: GalleryImage) => {
      openLightbox(image);
    },
    [openLightbox],
  );

  if (images.length === 0) {
    return (
      <div className="gallery-bento-frame pb-8 pt-4 sm:pb-10">
        <div className="gallery-bento" aria-hidden>
          {Array.from({ length: PREVIEW_TILE_COUNT }, (_, index) => (
            <div key={index} className="gallery-bento__item">
              <MediaPlaceholder
                loaded={false}
                tone="cream"
                showSheen={false}
                className="absolute inset-0 rounded-[0.95rem]"
              />
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
          className={cn(
            "gallery-bento",
            bentoCountClass,
            !isExpanded && "gallery-bento--collapsed",
          )}
        >
          {visibleImages.map((image) => (
            <AnimatedImage
              key={`${program}-${year}-${image.src}`}
              image={image}
              onActivate={handleImageActivate}
            />
          ))}
        </div>
      </div>

      {showViewMore && (
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
  onActivate: (image: GalleryImage) => void;
}

function AnimatedImage({ image, onActivate }: AnimatedImageProps) {
  const ref = React.useRef<HTMLButtonElement>(null);
  const isInView = useInView(ref, { once: true });
  const [isLoaded, setIsLoaded] = React.useState(false);
  const [hasError, setHasError] = React.useState(false);
  // Reveal an already-cached image whose load event fired before this handler
  // attached (hydration / bfcache / remount), which onLoad alone would miss.
  const imgRef = React.useCallback((node: HTMLImageElement | null) => {
    if (!node?.complete) return;
    if (node.naturalWidth > 0) setIsLoaded(true);
    else setHasError(true);
  }, []);

  return (
    <button
      ref={ref}
      type="button"
      className="gallery-bento__item gallery-bento__item--interactive"
      onClick={() => onActivate(image)}
      aria-label={`View ${image.alt}`}
    >
      <MediaPlaceholder
        loaded={isLoaded && !hasError}
        tone="cream"
        className="absolute inset-0 rounded-[0.95rem]"
      />
      {!hasError && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          ref={imgRef}
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
