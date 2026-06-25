"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import {
  GALLERY_CATEGORIES,
  gallerySelectionForProgram,
  getGalleryCategoryIndex,
  type GallerySelection,
} from "@/lib/gallery-categories";

// Spring (not bezier) so a rapid re-toggle interrupts smoothly instead of snapping.
const MORPH_TRANSITION = { type: "spring", stiffness: 500, damping: 40, mass: 0.7 } as const;
const ENTER_TRANSITION = { duration: 0.14, ease: [0.165, 0.84, 0.44, 1] as const };
// Exits read faster than enters — the pill leaving shouldn't linger behind the shrinking shape.
const EXIT_TRANSITION = { duration: 0.1, ease: [0.165, 0.84, 0.44, 1] as const };

interface GalleryFiltersProps {
  selection: GallerySelection;
  onSelect: (selection: GallerySelection) => void;
}

export function GalleryFilters({ selection, onSelect }: GalleryFiltersProps) {
  const [yearsOpen, setYearsOpen] = useState(false);
  const programIndex = getGalleryCategoryIndex(selection.program);
  const category = GALLERY_CATEGORIES[programIndex];
  const hasMultipleYears = category.years.length > 1;

  useEffect(() => {
    setYearsOpen(false);
  }, [category.slug]);

  const goToProgram = (direction: -1 | 1) => {
    const nextIndex =
      (programIndex + direction + GALLERY_CATEGORIES.length) %
      GALLERY_CATEGORIES.length;
    const next = GALLERY_CATEGORIES[nextIndex];
    onSelect(gallerySelectionForProgram(next.slug, selection.year));
  };

  const activeYear =
    category.years.find((item) => item.year === selection.year) ?? category.years[0];
  const visibleYears = yearsOpen ? category.years : [activeYear];

  return (
    <motion.div
      layout
      transition={MORPH_TRANSITION}
      className="gallery-controls"
      role="group"
      aria-label="Gallery program and year"
    >
      <div className="gallery-controls__program">
        <button
          type="button"
          aria-label="Previous program"
          className="gallery-controls__nav-button focus-ring-light"
          onClick={() => goToProgram(-1)}
        >
          <ChevronLeft className="gallery-controls__nav-icon" aria-hidden />
        </button>
        <span className="gallery-controls__program-label" title={category.program}>
          {category.program}
        </span>
        <button
          type="button"
          aria-label="Next program"
          className="gallery-controls__nav-button focus-ring-light"
          onClick={() => goToProgram(1)}
        >
          <ChevronRight className="gallery-controls__nav-icon" aria-hidden />
        </button>
      </div>

      <motion.div
        layout
        transition={MORPH_TRANSITION}
        className="gallery-controls__years"
      >
        <AnimatePresence initial={false} mode="popLayout">
          {visibleYears.map(({ year }) => {
            const isActive = selection.year === year;

            return (
              <motion.button
                key={`${category.slug}-${year}`}
                type="button"
                className="gallery-year-pill gallery-controls__year-pill focus-ring-light cursor-pointer"
                data-active={isActive ? "true" : undefined}
                aria-pressed={isActive}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0, transition: EXIT_TRANSITION }}
                transition={ENTER_TRANSITION}
                onClick={() => {
                  onSelect(gallerySelectionForProgram(category.slug, year));
                  setYearsOpen(false);
                }}
              >
                {year}
              </motion.button>
            );
          })}
        </AnimatePresence>

        <AnimatePresence initial={false}>
          {hasMultipleYears && (
            <motion.button
              key="years-toggle"
              layout="position"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0, transition: EXIT_TRANSITION }}
              transition={{ layout: MORPH_TRANSITION, opacity: ENTER_TRANSITION }}
              type="button"
              aria-label={yearsOpen ? "Hide other years" : "Show other years"}
              aria-expanded={yearsOpen}
              className="gallery-controls__years-toggle focus-ring-light"
              onClick={() => setYearsOpen((open) => !open)}
            >
              <motion.span
                animate={{ rotate: yearsOpen ? 180 : 0 }}
                transition={ENTER_TRANSITION}
                className="inline-flex"
              >
                <ChevronDown className="gallery-controls__years-toggle-icon" aria-hidden />
              </motion.span>
            </motion.button>
          )}
        </AnimatePresence>
      </motion.div>
    </motion.div>
  );
}
