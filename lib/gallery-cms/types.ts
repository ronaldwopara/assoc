export const PREVIEW_SLOT_COUNT = 6;

export type GalleryCmsImage = {
  src: string;
  ratio: number;
};

export type GalleryCmsYearEntry = {
  year: string;
  albumUrl: string;
  images: GalleryCmsImage[];
};

export type GalleryCmsProgram = {
  slug: string;
  title: string;
  years: GalleryCmsYearEntry[];
};

export type GalleryCmsData = {
  version: 1;
  updatedAt: string;
  programs: GalleryCmsProgram[];
};

export type GalleryCmsCategory = {
  slug: string;
  program: string;
  years: { year: string; href: string }[];
};
