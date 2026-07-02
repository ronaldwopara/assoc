const CLOUDINARY_BASE = "https://res.cloudinary.com/daldas2e7/image/upload";

const LANDSCAPE = 16 / 9;
const PORTRAIT = 9 / 16;
const BHM_LANDSCAPE = 1024 / 683;
const BHM_PORTRAIT = 1024 / 1536;
const ASB_LANDSCAPE = 4 / 3;
const ASB_2022_BANNER = 1170 / 662;
const ASB_2022_PORTRAIT = 1600 / 2133;
const ASB_2022_SCREENSHOT = 1118 / 1596;
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
    src: `${CLOUDINARY_BASE}/v1782769447/asosc/gallery-prev/black-history-month/bhm-2025-1.webp`,
    alt: "Black History Month celebration gathering",
    ratio: BHM_LANDSCAPE,
    program: "black-history-month",
    year: "2025",
  },
  {
    src: `${CLOUDINARY_BASE}/v1782769447/asosc/gallery-prev/black-history-month/bhm-2025-2.webp`,
    alt: "Black History Month community celebration",
    ratio: BHM_LANDSCAPE,
    program: "black-history-month",
    year: "2025",
  },
  {
    src: `${CLOUDINARY_BASE}/v1782769448/asosc/gallery-prev/black-history-month/bhm-2025-3.webp`,
    alt: "Black History Month attendees in conversation",
    ratio: BHM_LANDSCAPE,
    program: "black-history-month",
    year: "2025",
  },
  {
    src: `${CLOUDINARY_BASE}/v1782769449/asosc/gallery-prev/black-history-month/bhm-2025-5.webp`,
    alt: "Black History Month group photo",
    ratio: BHM_LANDSCAPE,
    program: "black-history-month",
    year: "2025",
  },
  {
    src: `${CLOUDINARY_BASE}/v1782769449/asosc/gallery-prev/black-history-month/bhm-2025-4.webp`,
    alt: "Black History Month event portrait",
    ratio: BHM_PORTRAIT,
    program: "black-history-month",
    year: "2025",
  },
  {
    src: `${CLOUDINARY_BASE}/v1782769450/asosc/gallery-prev/black-history-month/bhm-2025-6.webp`,
    alt: "Black History Month community moment",
    ratio: BHM_LANDSCAPE,
    program: "black-history-month",
    year: "2025",
  },
  {
    src: `${CLOUDINARY_BASE}/v1782770300/asosc/gallery-prev/african-summer-bbq/asb-2023-1.webp`,
    alt: "African Summer BBQ community gathering",
    ratio: ASB_LANDSCAPE,
    program: "african-summer-bbq",
    year: "2023",
  },
  {
    src: `${CLOUDINARY_BASE}/v1782770302/asosc/gallery-prev/african-summer-bbq/asb-2023-2.webp`,
    alt: "African Summer BBQ outdoor celebration",
    ratio: ASB_LANDSCAPE,
    program: "african-summer-bbq",
    year: "2023",
  },
  {
    src: `${CLOUDINARY_BASE}/v1782770303/asosc/gallery-prev/african-summer-bbq/asb-2023-3.webp`,
    alt: "African Summer BBQ attendees",
    ratio: ASB_LANDSCAPE,
    program: "african-summer-bbq",
    year: "2023",
  },
  {
    src: `${CLOUDINARY_BASE}/v1782770304/asosc/gallery-prev/african-summer-bbq/asb-2023-4.webp`,
    alt: "African Summer BBQ group photo",
    ratio: ASB_LANDSCAPE,
    program: "african-summer-bbq",
    year: "2023",
  },
  {
    src: `${CLOUDINARY_BASE}/v1782770304/asosc/gallery-prev/african-summer-bbq/asb-2023-5.webp`,
    alt: "African Summer BBQ community moment",
    ratio: ASB_LANDSCAPE,
    program: "african-summer-bbq",
    year: "2023",
  },
  {
    src: `${CLOUDINARY_BASE}/v1782770306/asosc/gallery-prev/african-summer-bbq/asb-2023-6.webp`,
    alt: "African Summer BBQ celebration highlight",
    ratio: ASB_LANDSCAPE,
    program: "african-summer-bbq",
    year: "2023",
  },
  {
    src: `${CLOUDINARY_BASE}/v1782785331/asosc/gallery-prev/african-summer-bbq/asb-2022-1.webp`,
    alt: "African Summer BBQ 2022 community banner",
    ratio: ASB_2022_BANNER,
    program: "african-summer-bbq",
    year: "2022",
  },
  {
    src: `${CLOUDINARY_BASE}/v1782785332/asosc/gallery-prev/african-summer-bbq/asb-2022-2.webp`,
    alt: "African Summer BBQ 2022 outdoor gathering",
    ratio: ASB_LANDSCAPE,
    program: "african-summer-bbq",
    year: "2022",
  },
  {
    src: `${CLOUDINARY_BASE}/v1782785332/asosc/gallery-prev/african-summer-bbq/asb-2022-3.webp`,
    alt: "African Summer BBQ 2022 event portrait",
    ratio: ASB_2022_PORTRAIT,
    program: "african-summer-bbq",
    year: "2022",
  },
  {
    src: `${CLOUDINARY_BASE}/v1782785333/asosc/gallery-prev/african-summer-bbq/asb-2022-4.webp`,
    alt: "African Summer BBQ 2022 community moment",
    ratio: ASB_LANDSCAPE,
    program: "african-summer-bbq",
    year: "2022",
  },
  {
    src: `${CLOUDINARY_BASE}/v1782785334/asosc/gallery-prev/african-summer-bbq/asb-2022-5.webp`,
    alt: "African Summer BBQ 2022 celebration highlight",
    ratio: ASB_LANDSCAPE,
    program: "african-summer-bbq",
    year: "2022",
  },
  {
    src: `${CLOUDINARY_BASE}/v1782785335/asosc/gallery-prev/african-summer-bbq/asb-2022-6.webp`,
    alt: "African Summer BBQ 2022 flyer",
    ratio: ASB_2022_SCREENSHOT,
    program: "african-summer-bbq",
    year: "2022",
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
  return GALLERY_IMAGES.filter(
    (image) =>
      (image.program === "african-festival" && image.year === "2025") ||
      (image.program === "end-of-year-party" && image.year === "2025"),
  ).map((image) => image.src);
}
