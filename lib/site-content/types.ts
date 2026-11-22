/** Everything on the public site that staff edit under Upgrade → Site sections. */

export type Slide = { src: string; alt: string };

export type HeroContent = {
  headline: string;
  subheadline: string;
  primaryButton: string;
  secondaryButton: string;
  slides: Slide[];
};

export type ValueItem = { title: string; text: string };

export type AboutContent = {
  mission: string[];
  vision: string;
  values: ValueItem[];
  /** Pictures beside Mission, Vision and Values, in that order. */
  images: string[];
};

export type ProgramBlock = {
  heading: string;
  /** Shown as a list. When empty, `body` is shown as a paragraph. */
  bullets: string[];
  body: string;
};

/** The six program tiles. Their places in the grid are fixed; the content isn't. */
export type ProgramContent = {
  area: "story" | "youth" | "festival" | "bhm" | "wellness" | "celebration";
  title: string;
  desc: string;
  video: string;
  description: string;
  blocks: ProgramBlock[];
};

export type ProgramsContent = {
  title: string;
  intro: string;
  items: ProgramContent[];
};

export type ActionId = "membership" | "donate" | "events" | "volunteer" | "vendor" | "contact";

export type ActionCard = { eyebrow: string; title: string; body: string; button: string };

export type EventItem = {
  title: string;
  /** Short tag on the ticket, e.g. AUG or ALL YEAR. */
  badge: string;
  location: string;
  when: string;
  video: string;
  /** Which program it scrolls to on the homepage, e.g. #festival. */
  href: string;
  /** Button on the event: "" for none. */
  actionLabel: "" | "Register" | "Volunteer";
  actionHref: string;
};

export type UpdateItem = {
  date: string;
  title: string;
  text: string;
  /** A YouTube link; optional. */
  video: string;
  linkLabel: string;
  linkHref: string;
  dark: boolean;
};

export type UpdatesContent = { items: UpdateItem[]; photos: string[] };

export type SponsorsContent = { eyebrow: string; title: string; text: string; logos: string[] };

export type BoardMember = { name: string; designation: string; src: string };

export type ContactContent = { email: string; phone: string; facebook: string; instagram: string };

export type SiteContent = {
  updatedAt: string;
  hero: HeroContent;
  about: AboutContent;
  programs: ProgramsContent;
  actions: Record<ActionId, ActionCard>;
  events: EventItem[];
  updates: UpdatesContent;
  sponsors: SponsorsContent;
  board: BoardMember[];
  contact: ContactContent;
};
