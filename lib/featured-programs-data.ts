export interface MediaItemType {
  id: number;
  type: "image" | "video";
  title: string;
  desc: string;
  url: string;
  area: "story" | "youth" | "festival" | "bhm" | "wellness";
  href: string;
}

export const featuredProgramsMedia: MediaItemType[] = [
  {
    id: 1,
    type: "video",
    title: "Our Story, Our Voice",
    desc: "Stories that build empathy and challenge stereotypes.",
    url: "/hero-clip.mp4",
    area: "story",
    href: "#our-story",
  },
  {
    id: 2,
    type: "image",
    title: "Youth Creative Media Lab",
    desc: "Raising the next generation of African leaders.",
    url: "/hero-slide-2.png",
    area: "youth",
    href: "#youth-lab",
  },
  {
    id: 3,
    type: "image",
    title: "African Festival",
    desc: "Celebrating African culture, food, music, and identity.",
    url: "/hero-slide-1.jpg",
    area: "festival",
    href: "#festival",
  },
  {
    id: 4,
    type: "image",
    title: "Black History Month",
    desc: "Honoring heritage and celebrating achievements.",
    url: "/hero-slide-3.jpg",
    area: "bhm",
    href: "#bhm",
  },
  {
    id: 5,
    type: "image",
    title: "Family Wellness Programs",
    desc: "Supporting strong, healthy African families.",
    url: "/hero-slide-1.jpg",
    area: "wellness",
    href: "#wellness",
  },
];
