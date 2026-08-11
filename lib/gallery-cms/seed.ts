import { GALLERY_CATEGORIES } from "@/lib/gallery-categories";
import { getGalleryImages } from "@/lib/gallery-images";
import {
  PREVIEW_SLOT_COUNT,
  type GalleryCmsData,
  type GalleryCmsImage,
  type GalleryCmsYearEntry,
} from "@/lib/gallery-cms/types";

const AFRICAN_FESTIVAL_ALBUM_URL =
  "https://photos.google.com/share/AF1QipMjTmDXrlT0oB55zdjvAP4nRnuDFGv3Sd1v7uRyZZCdsDEKbBbpvarV79JolyPNQQ?key=QVZOZTMxWUVCdXRNVWVIUFFmZGlPd2tjdUFiVDh3";
const BLACK_HISTORY_MONTH_ALBUM_URL =
  "https://photos.google.com/share/AF1QipMFMS-3m6HBsbaC__yDGCUTPjoJyk_PQDFSO1bt6SAWuGWVDxYj_wnlEQ_iKsjCog?key=Sk9yTTMtbzB6UFNzUjBnbFAzTzN0MFlJSENycFVn";
const BLACK_HISTORY_MONTH_2025_ALBUM_URL =
  "https://photos.google.com/share/AF1QipOZzdsANnX0qoKW_LCKFfxniQZZaQjm7z1pOpGavfahqyBIcNgMio_sESkxEMQkCg?key=cl80U3BPNFJ6VzVsMHF0WVRwSHU1dm1kQjZJdmNB";
const BLACK_HISTORY_MONTH_2022_ALBUM_URL =
  "https://photos.google.com/share/AF1QipMuqrtcE50Z11leAES8XzxZnpMK3HVcHtEjuKNMXSYURAwiolGPon93bXSJnZWtHA?key=TEdFZk9td05mM0F0Y2hQRzhMZ0lWaF9udHVFRkNn";
const AFRICAN_SUMMER_BBQ_2024_ALBUM_URL =
  "https://photos.google.com/share/AF1QipNdCzMh1qKAhBNN7nirvTHglhTPxhalg4itGsLnqeNJ2F9pyzZW1wgQzCs14Hd6vA?key=aDZqS3hSel9IUTdmdkExcWZ2R3VOZVBjeVMtQUFR";
const AFRICAN_SUMMER_BBQ_2023_ALBUM_URL =
  "https://photos.google.com/share/AF1QipMg2THI6p5J7B1M4hShpd1gMBVubIXZRlNybzw46N6jUpJsqpfkt8_V6jbYeAn5lg?key=UlMtVVQ2enZGMXZRRnJ1amZkSFVYUjJteG51MTlR";
const AFRICAN_SUMMER_BBQ_2022_ALBUM_URL =
  "https://photos.google.com/share/AF1QipPF8q3MlrmlSfFzT8D3Q3nh0wto6RphKudDzhcgqJVarRWU4kp4vLH751QsA-lDGw?key=UUE2elVFZlFwakxiMnkxMXJ6YmhQS0haSWhicUxR";
const END_OF_YEAR_PARTY_2025_ALBUM_URL =
  "https://photos.google.com/share/AF1QipNDqcwea4ouL9CbzIWcQWE1Li3OLL25PmrDC46e7wzYJe4aTvxdTM7wmfPmrY8pcA?key=NmM2OTRSQTVWazNvcnpCc1RqMDFDZk55RTR6MkJn";
const END_OF_YEAR_PARTY_2024_ALBUM_URL =
  "https://photos.google.com/share/AF1QipPROAi5aMzptLRQFzenlNGfNXMbiO17_H2or7BXTFZ3eBAVCl8cnNXTLwXjgs9ukw?key=NWZMNUEzUHhQMzA0eXFnQm1KOUs5dG5SUEsxekNR";

const SEED_ALBUM_URLS: Partial<Record<string, string>> = {
  "african-festival": AFRICAN_FESTIVAL_ALBUM_URL,
  "black-history-month": BLACK_HISTORY_MONTH_ALBUM_URL,
  "black-history-month:2025": BLACK_HISTORY_MONTH_2025_ALBUM_URL,
  "black-history-month:2022": BLACK_HISTORY_MONTH_2022_ALBUM_URL,
  "african-summer-bbq:2024": AFRICAN_SUMMER_BBQ_2024_ALBUM_URL,
  "african-summer-bbq:2023": AFRICAN_SUMMER_BBQ_2023_ALBUM_URL,
  "african-summer-bbq:2022": AFRICAN_SUMMER_BBQ_2022_ALBUM_URL,
  "end-of-year-party:2025": END_OF_YEAR_PARTY_2025_ALBUM_URL,
  "end-of-year-party:2024": END_OF_YEAR_PARTY_2024_ALBUM_URL,
};

function emptySlots(): GalleryCmsImage[] {
  return Array.from({ length: PREVIEW_SLOT_COUNT }, () => ({
    src: "",
    ratio: 16 / 9,
  }));
}

function albumFor(slug: string, year: string): string {
  return (
    SEED_ALBUM_URLS[`${slug}:${year}`] ?? SEED_ALBUM_URLS[slug] ?? ""
  );
}

function yearEntry(
  slug: string,
  year: string,
  images: ReturnType<typeof getGalleryImages>,
): GalleryCmsYearEntry {
  const yearImages = images.filter(
    (image) => image.program === slug && image.year === year,
  );
  const slots = emptySlots();
  yearImages.slice(0, PREVIEW_SLOT_COUNT).forEach((image, index) => {
    slots[index] = { src: image.src, ratio: image.ratio };
  });
  return {
    year,
    albumUrl: albumFor(slug, year),
    images: slots,
  };
}

/** Built-in content used until the first Save on /upgrade (or if Cloudinary CMS is missing). */
export function buildSeedGalleryCms(): GalleryCmsData {
  const images = getGalleryImages();
  return {
    version: 1,
    updatedAt: new Date(0).toISOString(),
    programs: GALLERY_CATEGORIES.map((category) => ({
      slug: category.slug,
      title: category.program,
      years: category.years.map(({ year }) => yearEntry(category.slug, year, images)),
    })),
    announcement: {
      enabled: false,
      text: "",
      href: "",
      speedSeconds: 26,
      direction: "ltr",
      pauseOnHover: true,
    },
  };
}
