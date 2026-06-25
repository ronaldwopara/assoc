"use client";

import { useCallback, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { GalleryFilters } from "@/components/gallery-filters";
import { ImageGallery } from "@/components/image-gallery";
import {
  gallerySelectionFromSearchParams,
  type GallerySelection,
} from "@/lib/gallery-categories";

export function GalleryPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const selection = useMemo(
    () =>
      gallerySelectionFromSearchParams(
        searchParams.get("program"),
        searchParams.get("year"),
      ),
    [searchParams],
  );

  const handleSelect = useCallback(
    (next: GallerySelection) => {
      const params = new URLSearchParams({
        program: next.program,
        year: next.year,
      });
      router.replace(`/gallery?${params.toString()}`, { scroll: false });
    },
    [router],
  );

  return (
    <div className="mx-auto w-full max-w-5xl px-4 pt-6 sm:pt-8">
      <GalleryFilters selection={selection} onSelect={handleSelect} />
      <ImageGallery program={selection.program} year={selection.year} />
    </div>
  );
}
