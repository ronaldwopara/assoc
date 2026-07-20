"use client";

import React from "react";
import { useInView } from "framer-motion";
import { GalleryLightbox } from "@/components/gallery-lightbox";
import { GALLERY_CATEGORIES } from "@/lib/gallery-categories";
import { getGalleryImagesForSelection, type GalleryImage } from "@/lib/gallery-images";
import { MediaPlaceholder } from "@/components/media-placeholder";
import { cn } from "@/lib/utils";

const AFRICAN_FESTIVAL_ALBUM_URL =
  "https://photos.google.com/share/AF1QipMjTmDXrlT0oB55zdjvAP4nRnuDFGv3Sd1v7uRyZZCdsDEKbBbpvarV79JolyPNQQ?key=QVZOZTMxWUVCdXRNVWVIUFFmZGlPd2tjdUFiVDh3";
const BLACK_HISTORY_MONTH_ALBUM_URL =
  "https://photos.google.com/share/AF1QipMFMS-3m6HBsbaC__yDGCUTPjoJyk_PQDFSO1bt6SAWuGWVDxYj_wnlEQ_iKsjCog?key=Sk9yTTMtbzB6UFNzUjBnbFAzTzN0MFlJSENycFVn";
const BLACK_HISTORY_MONTH_2025_ALBUM_URL =
  "https://photos.google.com/share/AF1QipOZzdsANnX0qoKW_LCKFfxniQZZaQjm7z1pOpGavfahqyBIcNgMio_sESkxEMQkCg?key=cl80U3BPNFJ6VzVsMHF0WVRwSHU1dm1kQjZJdmNB";
const BLACK_HISTORY_MONTH_2022_ALBUM_URL =
  "https://photos.google.com/share/AF1QipMuqrtcE50Z11leAES8XzxZnpMK3HVcHtEjuKNMXSYURAwiolGPon93bXSJnZWtHA?key=TEdFZk9td05mM0F0Y2hQRzhMZ0lWaF9udHVFRkNn";
const AFRICAN_SUMMER_BBQ_2024_ALBUM_URL =
  "https://photos.google.com/share/AF1QipNdCzMh1qKAhBNN7nirvTHglhTPxhalg4itGsLnqeNJ2F9pyzZW1wgQzCs14Hd6vA?key=aDZqS3hSel9IUTdmdkExcWZ2R3VOZVBjeVMtQUFR";
const AFRICAN_SUMMER_BBQ_2023_ALBUM_URL =
  "https://photos.google.com/share/AF1QipMg2THI6p5J7B1M4hShpd1gMBVubIXZRlNybzw46N6jUpJsqpfkt8_V6jbYeAn5lg?key=UlMtVVQ2enZGMXZRRnJ1amZkSFVYUjJteG51MTlR";
const AFRICAN_SUMMER_BBQ_2022_ALBUM_URL =
  "https://photos.google.com/share/AF1QipPF8q3MlrmlSfFzT8D3Q3nh0wto6RphKudDzhcgqJVarRWU4kp4vLH751QsA-lDGw?key=UUE2elVFZlFwakxiMnkxMXJ6YmhQS0haSWhicUxR";
const END_OF_YEAR_PARTY_2025_ALBUM_URL =
  "https://photos.google.com/share/AF1QipNDqcwea4ouL9CbzIWcQWE1Li3OLL25PmrDC46e7wzYJe4aTvxdTM7wmfPmrY8pcA?key=NmM2OTRSQTVWazNvcnpCc1RqMDFDZk55RTR6MkJn";
const END_OF_YEAR_PARTY_2024_ALBUM_URL =
  "https://photos.google.com/share/AF1QipPROAi5aMzptLRQFzenlNGfNXMbiO17_H2or7BXTFZ3eBAVCl8cnNXTLwXjgs9ukw?key=NWZMNUEzUHhQMzA0eXFnQm1KOUs5dG5SUEsxekNR";
const GALLERY_ALBUM_URLS: Partial<Record<string, string>> = {
  "african-festival": AFRICAN_FESTIVAL_ALBUM_URL,
  "black-history-month": BLACK_HISTORY_MONTH_ALBUM_URL,
  "black-history-month:2025": BLACK_HISTORY_MONTH_2025_ALBUM_URL,
  "black-history-month:2022": BLACK_HISTORY_MONTH_2022_ALBUM_URL,
  "african-summer-bbq:2024": AFRICAN_SUMMER_BBQ_2024_ALBUM_URL,
  "african-summer-bbq:2023": AFRICAN_SUMMER_BBQ_2023_ALBUM_URL,
  "african-summer-bbq:2022": AFRICAN_SUMMER_BBQ_2022_ALBUM_URL,
  "end-of-year-party:2025": END_OF_YEAR_PARTY_2025_ALBUM_URL,
  "end-of-year-party:2024": END_OF_YEAR_PARTY_2024_ALBUM_URL,
};

/** Collapsed preview always shows a neat 2×3 landscape grid (matches gallery reference). */
const PREVIEW_TILE_COUNT = 6;

interface ImageGalleryProps {
  program: string;
  year: string;
}

export function ImageGallery({ program, year }: ImageGalleryProps) {
  const images = getGalleryImagesForSelection(program, year);
  const albumUrl = GALLERY_ALBUM_URLS[`${program}:${year}`] ?? GALLERY_ALBUM_URLS[program];
  const [isExpanded, setIsExpanded] = React.useState(false);
  const [lightboxIndex, setLightboxIndex] = React.useState<number | null>(null);
  const categoryLabel =
    GALLERY_CATEGORIES.find((item) => item.slug === program)?.program ?? "Gallery";

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
                tone="light"
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
        tone="light"
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
