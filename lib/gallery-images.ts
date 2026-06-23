const CLOUDINARY_BASE = "https://res.cloudinary.com/daldas2e7/image/upload";

const LANDSCAPE = 16 / 9;
const PORTRAIT = 9 / 16;

export type GalleryImage = {
  src: string;
  alt: string;
  ratio: number;
};

const GALLERY_IMAGES: GalleryImage[] = [
  {
    src: `${CLOUDINARY_BASE}/v1782010322/asosc/gallery-prev/afc-1.webp`,
    alt: "African Festival community gathering",
    ratio: LANDSCAPE,
  },
  {
    src: `${CLOUDINARY_BASE}/v1782010323/asosc/gallery-prev/afc-2.webp`,
    alt: "African Festival celebration",
    ratio: PORTRAIT,
  },
  {
    src: `${CLOUDINARY_BASE}/v1782010324/asosc/gallery-prev/afc-3.webp`,
    alt: "African Festival cultural performance",
    ratio: LANDSCAPE,
  },
  {
    src: `${CLOUDINARY_BASE}/v1782010325/asosc/gallery-prev/afc-4.webp`,
    alt: "African Festival attendees",
    ratio: PORTRAIT,
  },
  {
    src: `${CLOUDINARY_BASE}/v1782010326/asosc/gallery-prev/afc-5.webp`,
    alt: "African Festival event highlights",
    ratio: LANDSCAPE,
  },
  {
    src: `${CLOUDINARY_BASE}/v1782010326/asosc/gallery-prev/afc-6.webp`,
    alt: "African Festival community moment",
    ratio: PORTRAIT,
  },
  {
    src: `${CLOUDINARY_BASE}/v1782010327/asosc/gallery-prev/eoyp-1.webp`,
    alt: "End of Year Party celebration",
    ratio: LANDSCAPE,
  },
  {
    src: `${CLOUDINARY_BASE}/v1782010328/asosc/gallery-prev/eoyp-2.webp`,
    alt: "End of Year Party gathering",
    ratio: PORTRAIT,
  },
  {
    src: `${CLOUDINARY_BASE}/v1782010330/asosc/gallery-prev/eoyp-3.webp`,
    alt: "End of Year Party festivities",
    ratio: LANDSCAPE,
  },
  {
    src: `${CLOUDINARY_BASE}/v1782010330/asosc/gallery-prev/eoyp-4.webp`,
    alt: "End of Year Party community photo",
    ratio: PORTRAIT,
  },
  {
    src: `${CLOUDINARY_BASE}/v1782010331/asosc/gallery-prev/eoyp-5.webp`,
    alt: "End of Year Party group photo",
    ratio: LANDSCAPE,
  },
];

export function getGalleryImages(): GalleryImage[] {
  return GALLERY_IMAGES;
}

export function getGalleryPreviewUrls(): string[] {
  return GALLERY_IMAGES.map((image) => image.src);
}
