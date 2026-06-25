"use client";

import { motion } from "framer-motion";
import {
  GALLERY_CATEGORIES,
  gallerySelectionForProgram,
  type GallerySelection,
} from "@/lib/gallery-categories";

// Spring (not bezier) so a rapid re-toggle interrupts smoothly instead of snapping.
const MORPH_TRANSITION = { type: "spring", stiffness: 500, damping: 40, mass: 0.7 } as const;

interface GalleryChooserProps {
  onSelect: (selection: GallerySelection) => void;
}

export function GalleryChooser({ onSelect }: GalleryChooserProps) {
  return (
    <motion.div
      layoutId="gallery-shell"
      layout
      transition={MORPH_TRANSITION}
      className="gallery-chooser"
      role="group"
      aria-label="Choose a gallery program and year"
    >
      {GALLERY_CATEGORIES.map((category) => (
        <div key={category.slug} className="gallery-chooser__group">
          <h3 className="gallery-chooser__heading">{category.program}</h3>
          <div className="gallery-chooser__years">
            {category.years.map(({ year }) => (
              <button
                key={`${category.slug}-${year}`}
                type="button"
                className="gallery-year-pill gallery-chooser__year-pill focus-ring-light cursor-pointer"
                onClick={() => onSelect(gallerySelectionForProgram(category.slug, year))}
              >
                {year}
              </button>
            ))}
          </div>
        </div>
      ))}
    </motion.div>
  );
}
