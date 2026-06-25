export type GalleryYear = { year: string; href: string };

export type GalleryCategory = {
  slug: string;
  program: string;
  years: GalleryYear[];
};

export const GALLERY_CATEGORIES: GalleryCategory[] = [
  {
    slug: "african-festival",
    program: "African Festival",
    years: [
      { year: "2025", href: "/gallery?program=african-festival&year=2025" },
      { year: "2024", href: "/gallery?program=african-festival&year=2024" },
    ],
  },
  {
    slug: "black-history-month",
    program: "Black History Month",
    years: [
      { year: "2025", href: "/gallery?program=black-history-month&year=2025" },
      { year: "2024", href: "/gallery?program=black-history-month&year=2024" },
    ],
  },
  {
    slug: "youth-creative-lab",
    program: "Youth Creative Lab",
    years: [{ year: "2025", href: "/gallery?program=youth-creative-lab&year=2025" }],
  },
  {
    slug: "family-wellness-seminars",
    program: "Family Wellness Seminars",
    years: [{ year: "2025", href: "/gallery?program=family-wellness-seminars&year=2025" }],
  },
  {
    slug: "end-of-year-party",
    program: "End-of-Year/Volunteer Appreciation Party",
    years: [{ year: "2025", href: "/gallery?program=end-of-year-party&year=2025" }],
  },
];

export type GallerySelection = {
  program: string;
  year: string;
};

export const DEFAULT_GALLERY_SELECTION: GallerySelection = {
  program: GALLERY_CATEGORIES[0].slug,
  year: GALLERY_CATEGORIES[0].years[0].year,
};

export function isValidGallerySelection(
  program: string | null,
  year: string | null,
): program is string {
  if (!program || !year) return false;
  const category = GALLERY_CATEGORIES.find((item) => item.slug === program);
  return category?.years.some((item) => item.year === year) ?? false;
}

export function gallerySelectionFromSearchParams(
  program: string | null,
  year: string | null,
): GallerySelection {
  if (program && year && isValidGallerySelection(program, year)) {
    return { program, year };
  }
  return DEFAULT_GALLERY_SELECTION;
}

/** Navbar / mobile nav dropdown shape (program label + year links). */
export function getGalleryDropdown() {
  return GALLERY_CATEGORIES.map(({ program, years }) => ({ program, years }));
}

export function getGalleryCategoryIndex(slug: string) {
  const index = GALLERY_CATEGORIES.findIndex((item) => item.slug === slug);
  return index >= 0 ? index : 0;
}

export function resolveYearForProgram(program: string, year: string) {
  const category = GALLERY_CATEGORIES.find((item) => item.slug === program);
  if (!category) return DEFAULT_GALLERY_SELECTION.year;
  if (category.years.some((item) => item.year === year)) return year;
  return category.years[0].year;
}

export function gallerySelectionForProgram(
  program: string,
  year: string,
): GallerySelection {
  return { program, year: resolveYearForProgram(program, year) };
}
