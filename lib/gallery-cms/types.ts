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

export type AnnouncementCms = {
  enabled: boolean;
  text: string;
  href: string;
  /** Seconds for one full marquee loop. Lower = faster. */
  speedSeconds: number;
  direction: "ltr" | "rtl";
  pauseOnHover: boolean;
};

export type GalleryCmsData = {
  version: 1;
  updatedAt: string;
  programs: GalleryCmsProgram[];
  announcement: AnnouncementCms;
};

export type GalleryCmsCategory = {
  slug: string;
  program: string;
  years: { year: string; href: string }[];
};
