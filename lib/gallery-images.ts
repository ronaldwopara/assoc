const CLOUDINARY_BASE = "https://res.cloudinary.com/daldas2e7/image/upload";

const LANDSCAPE = 16 / 9;
const PORTRAIT = 9 / 16;
const AF_LANDSCAPE = 1024 / 683;
const AF_PORTRAIT = 1024 / 1388;
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
    src: `${CLOUDINARY_BASE}/v1784027715/asosc/gallery-prev/african-festival/afc-2025-1.webp`,
    alt: "African Festival community gathering",
    ratio: AF_LANDSCAPE,
    program: "african-festival",
    year: "2025",
  },
  {
    src: `${CLOUDINARY_BASE}/v1784027716/asosc/gallery-prev/african-festival/afc-2025-8.webp`,
    alt: "African Festival celebration",
    ratio: 1024 / 681,
    program: "african-festival",
    year: "2025",
  },
  {
    src: `${CLOUDINARY_BASE}/v1784027717/asosc/gallery-prev/african-festival/afc-2025-16.webp`,
    alt: "African Festival cultural performance",
    ratio: AF_LANDSCAPE,
    program: "african-festival",
    year: "2025",
  },
  {
    src: `${CLOUDINARY_BASE}/v1784027718/asosc/gallery-prev/african-festival/afc-2025-22.webp`,
    alt: "African Festival attendees",
    ratio: AF_PORTRAIT,
    program: "african-festival",
    year: "2025",
  },
  {
    src: `${CLOUDINARY_BASE}/v1784027719/asosc/gallery-prev/african-festival/afc-2025-30.webp`,
    alt: "African Festival event highlights",
    ratio: AF_LANDSCAPE,
    program: "african-festival",
    year: "2025",
  },
  {
    src: `${CLOUDINARY_BASE}/v1784027782/asosc/gallery-prev/african-festival/afc-2025-34.webp`,
    alt: "African Festival community moment",
    ratio: 1024 / 745,
    program: "african-festival",
    year: "2025",
  },
  {
    src: `${CLOUDINARY_BASE}/v1782769447/asosc/gallery-prev/black-history-month/bhm-2025-1.webp`,
    alt: "Black History Month celebration gathering",
    ratio: BHM_LANDSCAPE,
    program: "black-history-month",
    year: "2026",
  },
  {
    src: `${CLOUDINARY_BASE}/v1782769447/asosc/gallery-prev/black-history-month/bhm-2025-2.webp`,
    alt: "Black History Month community celebration",
    ratio: BHM_LANDSCAPE,
    program: "black-history-month",
    year: "2026",
  },
  {
    src: `${CLOUDINARY_BASE}/v1782769448/asosc/gallery-prev/black-history-month/bhm-2025-3.webp`,
    alt: "Black History Month attendees in conversation",
    ratio: BHM_LANDSCAPE,
    program: "black-history-month",
    year: "2026",
  },
  {
    src: `${CLOUDINARY_BASE}/v1782769449/asosc/gallery-prev/black-history-month/bhm-2025-5.webp`,
    alt: "Black History Month group photo",
    ratio: BHM_LANDSCAPE,
    program: "black-history-month",
    year: "2026",
  },
  {
    src: `${CLOUDINARY_BASE}/v1782769449/asosc/gallery-prev/black-history-month/bhm-2025-4.webp`,
    alt: "Black History Month event portrait",
    ratio: BHM_PORTRAIT,
    program: "black-history-month",
    year: "2026",
  },
  {
    src: `${CLOUDINARY_BASE}/v1782769450/asosc/gallery-prev/black-history-month/bhm-2025-6.webp`,
    alt: "Black History Month community moment",
    ratio: BHM_LANDSCAPE,
    program: "black-history-month",
    year: "2026",
  },
  {
    src: `${CLOUDINARY_BASE}/v1784030151/asosc/gallery-prev/black-history-month/bhm25-1.webp`,
    alt: "Black History Month 2025 celebration",
    ratio: 1536 / 2048,
    program: "black-history-month",
    year: "2025",
  },
  {
    src: `${CLOUDINARY_BASE}/v1784030152/asosc/gallery-prev/black-history-month/bhm25-2.webp`,
    alt: "Black History Month 2025 gathering",
    ratio: 1600 / 1200,
    program: "black-history-month",
    year: "2025",
  },
  {
    src: `${CLOUDINARY_BASE}/v1784030153/asosc/gallery-prev/black-history-month/bhm25-3.webp`,
    alt: "Black History Month 2025 portrait",
    ratio: 1200 / 1600,
    program: "black-history-month",
    year: "2025",
  },
  {
    src: `${CLOUDINARY_BASE}/v1784030154/asosc/gallery-prev/black-history-month/bhm25-4.webp`,
    alt: "Black History Month 2025 community photo",
    ratio: 1600 / 1200,
    program: "black-history-month",
    year: "2025",
  },
  {
    src: `${CLOUDINARY_BASE}/v1784030155/asosc/gallery-prev/black-history-month/bhm25-5.webp`,
    alt: "Black History Month 2025 attendees",
    ratio: 1200 / 1600,
    program: "black-history-month",
    year: "2025",
  },
  {
    src: `${CLOUDINARY_BASE}/v1784030156/asosc/gallery-prev/black-history-month/bhm25-6.webp`,
    alt: "Black History Month 2025 moment",
    ratio: 1600 / 1200,
    program: "black-history-month",
    year: "2025",
  },
  {
    src: `${CLOUDINARY_BASE}/v1784031299/asosc/gallery-prev/black-history-month/bhm22-1.webp`,
    alt: "Black History Month 2022 celebration",
    ratio: 1600 / 1200,
    program: "black-history-month",
    year: "2022",
  },
  {
    src: `${CLOUDINARY_BASE}/v1784031301/asosc/gallery-prev/black-history-month/bhm22-2.webp`,
    alt: "Black History Month 2022 portrait",
    ratio: 797 / 2016,
    program: "black-history-month",
    year: "2022",
  },
  {
    src: `${CLOUDINARY_BASE}/v1784031302/asosc/gallery-prev/black-history-month/bhm22-3.webp`,
    alt: "Black History Month 2022 gathering",
    ratio: 1437 / 2000,
    program: "black-history-month",
    year: "2022",
  },
  {
    src: `${CLOUDINARY_BASE}/v1784029850/asosc/gallery-prev/african-summer-bbq/asb-2024-1.webp`,
    alt: "African Summer BBQ 2024 community gathering",
    ratio: 1600 / 1205,
    program: "african-summer-bbq",
    year: "2024",
  },
  {
    src: `${CLOUDINARY_BASE}/v1784029852/asosc/gallery-prev/african-summer-bbq/asb-2024-2.webp`,
    alt: "African Summer BBQ 2024 celebration",
    ratio: 1536 / 2048,
    program: "african-summer-bbq",
    year: "2024",
  },
  {
    src: `${CLOUDINARY_BASE}/v1784029853/asosc/gallery-prev/african-summer-bbq/asb-2024-3.webp`,
    alt: "African Summer BBQ 2024 outdoor gathering",
    ratio: 1600 / 1200,
    program: "african-summer-bbq",
    year: "2024",
  },
  {
    src: `${CLOUDINARY_BASE}/v1784029854/asosc/gallery-prev/african-summer-bbq/asb-2024-4.webp`,
    alt: "African Summer BBQ 2024 guests",
    ratio: 1600 / 1200,
    program: "african-summer-bbq",
    year: "2024",
  },
  {
    src: `${CLOUDINARY_BASE}/v1784029856/asosc/gallery-prev/african-summer-bbq/asb-2024-5.webp`,
    alt: "African Summer BBQ 2024 picnic",
    ratio: 1536 / 2048,
    program: "african-summer-bbq",
    year: "2024",
  },
  {
    src: `${CLOUDINARY_BASE}/v1784029858/asosc/gallery-prev/african-summer-bbq/asb-2024-6.webp`,
    alt: "African Summer BBQ 2024 moment",
    ratio: 1536 / 2048,
    program: "african-summer-bbq",
    year: "2024",
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
    src: `${CLOUDINARY_BASE}/v1784029567/asosc/gallery-prev/youth-creative-lab/ycl-2025-1.webp`,
    alt: "Youth Creative Lab 2025 workshop",
    ratio: 1600 / 1200,
    program: "youth-creative-lab",
    year: "2025",
  },
  {
    src: `${CLOUDINARY_BASE}/v1784029569/asosc/gallery-prev/youth-creative-lab/ycl-2025-2.webp`,
    alt: "Youth Creative Lab 2025 activity",
    ratio: 1600 / 1200,
    program: "youth-creative-lab",
    year: "2025",
  },
  {
    src: `${CLOUDINARY_BASE}/v1784029570/asosc/gallery-prev/youth-creative-lab/ycl-2025-3.webp`,
    alt: "Youth Creative Lab 2025 creative session",
    ratio: 1600 / 1200,
    program: "youth-creative-lab",
    year: "2025",
  },
  {
    src: `${CLOUDINARY_BASE}/v1784029571/asosc/gallery-prev/youth-creative-lab/ycl-2025-4.webp`,
    alt: "Youth Creative Lab 2025 participants",
    ratio: 1600 / 1200,
    program: "youth-creative-lab",
    year: "2025",
  },
  {
    src: `${CLOUDINARY_BASE}/v1784029572/asosc/gallery-prev/youth-creative-lab/ycl-2025-5.webp`,
    alt: "Youth Creative Lab 2025 moment",
    ratio: 1600 / 1200,
    program: "youth-creative-lab",
    year: "2025",
  },
  {
    src: `${CLOUDINARY_BASE}/v1784029574/asosc/gallery-prev/youth-creative-lab/ycl-2025-6.webp`,
    alt: "Youth Creative Lab 2025 group",
    ratio: 1600 / 1200,
    program: "youth-creative-lab",
    year: "2025",
  },
  {
    src: `${CLOUDINARY_BASE}/v1784028810/asosc/gallery-prev/end-of-year-party/eoyp-2025-1.webp`,
    alt: "End of Year Party 2025 celebration",
    ratio: 1600 / 1200,
    program: "end-of-year-party",
    year: "2025",
  },
  {
    src: `${CLOUDINARY_BASE}/v1784028811/asosc/gallery-prev/end-of-year-party/eoyp-2025-2.webp`,
    alt: "End of Year Party 2025 gathering",
    ratio: 1206 / 1312,
    program: "end-of-year-party",
    year: "2025",
  },
  {
    src: `${CLOUDINARY_BASE}/v1784028812/asosc/gallery-prev/end-of-year-party/eoyp-2025-3.webp`,
    alt: "End of Year Party 2025 festivities",
    ratio: 1600 / 1200,
    program: "end-of-year-party",
    year: "2025",
  },
  {
    src: `${CLOUDINARY_BASE}/v1784028813/asosc/gallery-prev/end-of-year-party/eoyp-2025-4.webp`,
    alt: "End of Year Party 2025 community photo",
    ratio: 1600 / 1200,
    program: "end-of-year-party",
    year: "2025",
  },
  {
    src: `${CLOUDINARY_BASE}/v1784028813/asosc/gallery-prev/end-of-year-party/eoyp-2025-5.webp`,
    alt: "End of Year Party 2025 group photo",
    ratio: 1600 / 1200,
    program: "end-of-year-party",
    year: "2025",
  },
  {
    src: `${CLOUDINARY_BASE}/v1784028814/asosc/gallery-prev/end-of-year-party/eoyp-2025-6.webp`,
    alt: "End of Year Party 2025 moment",
    ratio: 1600 / 1200,
    program: "end-of-year-party",
    year: "2025",
  },
  {
    src: `${CLOUDINARY_BASE}/v1782010327/asosc/gallery-prev/eoyp-1.webp`,
    alt: "End of Year Party celebration",
    ratio: LANDSCAPE,
    program: "end-of-year-party",
    year: "2024",
  },
  {
    src: `${CLOUDINARY_BASE}/v1782010328/asosc/gallery-prev/eoyp-2.webp`,
    alt: "End of Year Party gathering",
    ratio: PORTRAIT,
    program: "end-of-year-party",
    year: "2024",
  },
  {
    src: `${CLOUDINARY_BASE}/v1782350863/asosc/gallery-prev/eoyp-3.webp`,
    alt: "End of Year Party festivities",
    ratio: EOYP_REPLACEMENT_RATIO,
    program: "end-of-year-party",
    year: "2024",
  },
  {
    src: `${CLOUDINARY_BASE}/v1782350864/asosc/gallery-prev/eoyp-4.webp`,
    alt: "End of Year Party community photo",
    ratio: EOYP_REPLACEMENT_RATIO,
    program: "end-of-year-party",
    year: "2024",
  },
  {
    src: `${CLOUDINARY_BASE}/v1782350865/asosc/gallery-prev/eoyp-5.webp`,
    alt: "End of Year Party group photo",
    ratio: EOYP_REPLACEMENT_RATIO,
    program: "end-of-year-party",
    year: "2024",
  },
  {
    src: `${CLOUDINARY_BASE}/v1784030990/asosc/gallery-prev/end-of-year-party/eoyp-2024-6.webp`,
    alt: "End of Year Party 2024 moment",
    ratio: 1600 / 1204,
    program: "end-of-year-party",
    year: "2024",
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
