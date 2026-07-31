import {
  PREVIEW_SLOT_COUNT,
  type GalleryCmsCategory,
  type GalleryCmsData,
  type GalleryCmsImage,
  type GalleryCmsProgram,
  type GalleryCmsYearEntry,
} from "@/lib/gallery-cms/types";
import type { GalleryImage } from "@/lib/gallery-images";
import type { GallerySelection } from "@/lib/gallery-categories";

function isImage(value: unknown): value is GalleryCmsImage {
  if (!value || typeof value !== "object") return false;
  const image = value as GalleryCmsImage;
  return typeof image.src === "string" && typeof image.ratio === "number";
}

function normalizeYear(entry: GalleryCmsYearEntry): GalleryCmsYearEntry {
  const images = [...entry.images.filter(isImage)];
  while (images.length < PREVIEW_SLOT_COUNT) {
    images.push({ src: "", ratio: 16 / 9 });
  }
  return {
    year: String(entry.year).trim(),
    albumUrl: typeof entry.albumUrl === "string" ? entry.albumUrl.trim() : "",
    images: images.slice(0, PREVIEW_SLOT_COUNT),
  };
}

function normalizeProgram(program: GalleryCmsProgram): GalleryCmsProgram | null {
  const slug = typeof program.slug === "string" ? program.slug.trim() : "";
  const title = typeof program.title === "string" ? program.title.trim() : "";
  if (!slug || !title) return null;
  const years = (Array.isArray(program.years) ? program.years : [])
    .map(normalizeYear)
    .filter((year) => year.year.length > 0);
  return { slug, title, years };
}

export function normalizeGalleryCmsData(
  input: unknown,
  fallback?: GalleryCmsData,
): GalleryCmsData {
  if (!input || typeof input !== "object") {
    return (
      fallback ?? {
        version: 1,
        updatedAt: new Date().toISOString(),
        programs: [],
      }
    );
  }
  const raw = input as Partial<GalleryCmsData>;
  const programs = (Array.isArray(raw.programs) ? raw.programs : [])
    .map(normalizeProgram)
    .filter((program): program is GalleryCmsProgram => program !== null);

  return {
    version: 1,
    updatedAt:
      typeof raw.updatedAt === "string" ? raw.updatedAt : new Date().toISOString(),
    programs,
  };
}

export function cmsToCategories(data: GalleryCmsData): GalleryCmsCategory[] {
  return data.programs.map((program) => ({
    slug: program.slug,
    program: program.title,
    years: program.years.map((year) => ({
      year: year.year,
      href: `/gallery?program=${encodeURIComponent(program.slug)}&year=${encodeURIComponent(year.year)}`,
    })),
  }));
}

export function cmsToGalleryImages(data: GalleryCmsData): GalleryImage[] {
  const images: GalleryImage[] = [];
  for (const program of data.programs) {
    for (const year of program.years) {
      year.images.forEach((image, index) => {
        if (!image.src) return;
        images.push({
          src: image.src,
          alt: `${program.title} ${year.year} — ${index + 1}`,
          ratio: image.ratio > 0 ? image.ratio : 16 / 9,
          program: program.slug,
          year: year.year,
        });
      });
    }
  }
  return images;
}

export function getImagesForSelection(
  data: GalleryCmsData,
  program: string,
  year: string,
): GalleryImage[] {
  return cmsToGalleryImages(data).filter(
    (image) => image.program === program && image.year === year,
  );
}

export function getAlbumUrl(
  data: GalleryCmsData,
  program: string,
  year: string,
): string | undefined {
  const entry = data.programs
    .find((item) => item.slug === program)
    ?.years.find((item) => item.year === year);
  const url = entry?.albumUrl?.trim();
  return url || undefined;
}

export function getGalleryPreviewUrlsFromCms(data: GalleryCmsData): string[] {
  return cmsToGalleryImages(data)
    .filter(
      (image) =>
        (image.program === "african-festival" && image.year === "2025") ||
        (image.program === "end-of-year-party" && image.year === "2025"),
    )
    .map((image) => image.src);
}

export function defaultSelectionFromCms(data: GalleryCmsData): GallerySelection {
  const first = data.programs[0];
  const year = first?.years[0]?.year;
  if (first && year) return { program: first.slug, year };
  return { program: "african-festival", year: "2025" };
}

export function isValidSelection(
  data: GalleryCmsData,
  program: string | null,
  year: string | null,
): program is string {
  if (!program || !year) return false;
  return data.programs.some(
    (item) =>
      item.slug === program && item.years.some((entry) => entry.year === year),
  );
}

export function selectionFromSearchParams(
  data: GalleryCmsData,
  program: string | null,
  year: string | null,
): GallerySelection {
  if (program && year && isValidSelection(data, program, year)) {
    return { program, year };
  }
  return defaultSelectionFromCms(data);
}

export function resolveYearForProgramCms(
  data: GalleryCmsData,
  program: string,
  year: string,
) {
  const category = data.programs.find((item) => item.slug === program);
  if (!category || category.years.length === 0) {
    return defaultSelectionFromCms(data).year;
  }
  if (category.years.some((item) => item.year === year)) return year;
  return category.years[0].year;
}
