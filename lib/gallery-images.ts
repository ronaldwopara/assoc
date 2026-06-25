const CLOUDINARY_BASE = "https://res.cloudinary.com/daldas2e7/image/upload";

const LANDSCAPE = 16 / 9;
const PORTRAIT = 9 / 16;
const EOYP_REPLACEMENT_RATIO = 1600 / 1204;

export type GalleryImage = {
  src: string;
  alt: string;
  ratio: number;
  program: string;
  year: string;
};

const GALLERY_IMAGES: GalleryImage[] = [
  {
    src: `${CLOUDINARY_BASE}/v1782010322/asosc/gallery-prev/afc-1.webp`,
    alt: "African Festival community gathering",
    ratio: LANDSCAPE,
    program: "african-festival",
    year: "2025",
  },
  {
    src: `${CLOUDINARY_BASE}/v1782010323/asosc/gallery-prev/afc-2.webp`,
    alt: "African Festival celebration",
    ratio: PORTRAIT,
    program: "african-festival",
    year: "2025",
  },
  {
    src: `${CLOUDINARY_BASE}/v1782010324/asosc/gallery-prev/afc-3.webp`,
    alt: "African Festival cultural performance",
    ratio: LANDSCAPE,
    program: "african-festival",
    year: "2025",
  },
  {
    src: `${CLOUDINARY_BASE}/v1782010325/asosc/gallery-prev/afc-4.webp`,
    alt: "African Festival attendees",
    ratio: PORTRAIT,
    program: "african-festival",
    year: "2025",
  },
  {
    src: `${CLOUDINARY_BASE}/v1782010326/asosc/gallery-prev/afc-5.webp`,
    alt: "African Festival event highlights",
    ratio: LANDSCAPE,
    program: "african-festival",
    year: "2025",
  },
  {
    src: `${CLOUDINARY_BASE}/v1782010326/asosc/gallery-prev/afc-6.webp`,
    alt: "African Festival community moment",
    ratio: PORTRAIT,
    program: "african-festival",
    year: "2025",
  },
  {
    src: `${CLOUDINARY_BASE}/v1782010327/asosc/gallery-prev/eoyp-1.webp`,
    alt: "End of Year Party celebration",
    ratio: LANDSCAPE,
    program: "end-of-year-party",
    year: "2025",
  },
  {
    src: `${CLOUDINARY_BASE}/v1782010328/asosc/gallery-prev/eoyp-2.webp`,
    alt: "End of Year Party gathering",
    ratio: PORTRAIT,
    program: "end-of-year-party",
    year: "2025",
  },
  {
    src: `${CLOUDINARY_BASE}/v1782350863/asosc/gallery-prev/eoyp-3.webp`,
    alt: "End of Year Party festivities",
    ratio: EOYP_REPLACEMENT_RATIO,
    program: "end-of-year-party",
    year: "2025",
  },
  {
    src: `${CLOUDINARY_BASE}/v1782350864/asosc/gallery-prev/eoyp-4.webp`,
    alt: "End of Year Party community photo",
    ratio: EOYP_REPLACEMENT_RATIO,
    program: "end-of-year-party",
    year: "2025",
  },
  {
    src: `${CLOUDINARY_BASE}/v1782350865/asosc/gallery-prev/eoyp-5.webp`,
    alt: "End of Year Party group photo",
    ratio: EOYP_REPLACEMENT_RATIO,
    program: "end-of-year-party",
    year: "2025",
  },
];

export function getGalleryImages(): GalleryImage[] {
  return GALLERY_IMAGES;
}

export function getGalleryImagesForSelection(program: string, year: string): GalleryImage[] {
  return GALLERY_IMAGES.filter(
    (image) => image.program === program && image.year === year,
  );
}

export function getGalleryPreviewUrls(): string[] {
  return GALLERY_IMAGES.map((image) => image.src);
}
