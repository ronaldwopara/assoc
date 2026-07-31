"use client";

import { useCallback, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { GalleryChooser } from "@/components/gallery-chooser";
import { GalleryFilters } from "@/components/gallery-filters";
import { ImageGallery } from "@/components/image-gallery";
import { useGalleryCms } from "@/components/gallery-cms-provider";
import { selectionFromSearchParams } from "@/lib/gallery-cms/helpers";
import type { GallerySelection } from "@/lib/gallery-categories";

const FADE_TRANSITION = { duration: 0.18, ease: [0.165, 0.84, 0.44, 1] as const };

export function GalleryPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const cms = useGalleryCms();
  const [hasChosen, setHasChosen] = useState(false);

  const selection = useMemo(
    () =>
      selectionFromSearchParams(
        cms,
        searchParams.get("program"),
        searchParams.get("year"),
      ),
    [cms, searchParams],
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

  const handleChoose = useCallback(
    (next: GallerySelection) => {
      handleSelect(next);
      setHasChosen(true);
    },
    [handleSelect],
  );

  return (
    <div className="mx-auto w-full max-w-5xl px-4 pt-6 sm:pt-8">
      <AnimatePresence mode="wait" initial={false}>
        {!hasChosen ? (
          <GalleryChooser key="chooser" onSelect={handleChoose} />
        ) : (
          <motion.div
            key="filters"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={FADE_TRANSITION}
          >
            <GalleryFilters
              selection={selection}
              onSelect={handleSelect}
              onReopen={() => setHasChosen(false)}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {hasChosen && (
        <ImageGallery program={selection.program} year={selection.year} />
      )}
    </div>
  );
}
