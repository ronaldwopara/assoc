import { SETTLEMENT_WELLBEING_TITLE } from "@/lib/program-names";

export interface ProgramSection {
  heading: string;
  bullets?: string[];
  body?: string;
}

export interface ProgramDetails {
  description: string;
  sections?: ProgramSection[];
}

export interface MediaItemType {
  id: number;
  type: "image" | "video";
  title: string;
  desc: string;
  url: string;
  area: "story" | "youth" | "festival" | "bhm" | "wellness" | "celebration";
  href: string;
  details?: ProgramDetails;
}

export const featuredProgramsMedia: MediaItemType[] = [
  {
    id: 1,
    type: "video",
    title: "Our Story, Our Voice",
    desc: "Stories that change perspectives.",
    url: "https://res.cloudinary.com/daldas2e7/video/upload/v1782762601/asosc/videos/our-story-optimized.mp4",
    area: "story",
    href: "#our-story",
    details: {
      description:
        "Our Story Our Voice is a powerful storytelling platform created in partnership with Busayo Disu to share the lived experiences of African immigrants in Canada through film and community dialogue.",
      sections: [
        {
          heading: "Projects",
          bullets: [
            "Documentary series (annual releases)",
            "Public screenings and discussions",
          ],
        },
        {
          heading: "Impact",
          body: "Promotes empathy, reduces bias, and serves as an educational resource in schools and communities.",
        },
      ],
    },
  },
  {
    id: 2,
    type: "video",
    title: "Youth Creative Lab",
    desc: "Raising the next generation of African leaders.",
    url: "https://res.cloudinary.com/daldas2e7/video/upload/v1782760767/asosc/videos/youth-creative-media-lab-optimized-20260629.mp4",
    area: "youth",
    href: "#youth-lab",
    details: {
      description:
        "A youth-led creative hub where African youth hone their skills in storytelling, filmmaking, digital media production, visual and performance art.",
      sections: [
        {
          heading: "Activities",
          bullets: [
            "Film production",
            "Podcasting",
            "Event planning and management",
            "Media and Storytelling",
            "Visual and Performance art",
          ],
        },
        {
          heading: "Skills Developed",
          bullets: [
            "Leadership and team-building",
            "Storytelling and Creative Art",
            "Public speaking",
            "Cultural identity and confidence",
          ],
        },
        {
          heading: "Why It Matters",
          body: "Youth reclaim their narratives, build careers, and contribute positively to their communities.",
        },
      ],
    },
  },
  {
    id: 3,
    type: "video",
    title: "African Festival",
    desc: "Celebrating culture. Connecting community.",
    url: "https://res.cloudinary.com/daldas2e7/video/upload/v1782756282/asosc/videos/african-festival-optimized.mp4",
    area: "festival",
    href: "#festival",
    details: {
      description:
        "An annual cultural celebration showcasing African heritage through food, music, fashion, and art.",
      sections: [
        {
          heading: "Highlights",
          bullets: [
            "Cultural performances",
            "Food exhibitions",
            "Fashion shows",
            "Art displays",
          ],
        },
        {
          heading: "Impact",
          bullets: [
            "Promotes multiculturalism",
            "Builds community connection",
            "Celebrates African identity and pride",
          ],
        },
      ],
    },
  },
  {
    id: 4,
    type: "video",
    title: "Black History Month",
    desc: "Honoring heritage and celebrating achievements.",
    url: "https://res.cloudinary.com/daldas2e7/video/upload/v1782761786/asosc/videos/black-history-month-optimized.mp4",
    area: "bhm",
    href: "#bhm",
    details: {
      description:
        "A flagship event featuring the launch of new Our Story, Our Voice documentary episodes.",
      sections: [
        {
          heading: "Activities",
          bullets: [
            "Film screenings",
            "Panel discussions",
            "Community dialogue",
            "Cultural showcases",
          ],
        },
        {
          heading: "Impact",
          body: "Creates space for youth expressions, storytelling, learning, and dialogue that promote cultural understanding, inclusion, and meaningful community connection.",
        },
      ],
    },
  },
  {
    id: 5,
    type: "video",
    title: SETTLEMENT_WELLBEING_TITLE,
    desc: "Supporting strong communities and healthy African families.",
    url: "https://res.cloudinary.com/daldas2e7/video/upload/v1782758607/asosc/videos/family-wellness-seminars-optimized.mp4",
    area: "wellness",
    href: "#wellness",
    details: {
      description:
        "Supporting African families as they navigate cultural transitions and the realities of immigration.",
      sections: [
        {
          heading: "Why This Program Exists",
          bullets: [
            "Cultural shifts in parenting and gender roles",
            "Financial and career challenges",
            "Loss of extended family support",
          ],
        },
        {
          heading: "What We Provide",
          bullets: [
            "Educational seminars",
            "Expert-led discussions",
            "Safe spaces for dialogue",
          ],
        },
        {
          heading: "Impact",
          body: "Improves family relationships, emotional wellbeing, and community stability.",
        },
      ],
    },
  },
  {
    id: 6,
    type: "video",
    title: "End-of-Year/Volunteer Appreciation Party",
    desc: "Celebrating togetherness.",
    url: "https://res.cloudinary.com/daldas2e7/video/upload/v1782758139/asosc/videos/annual-end-of-year-celebration-optimized.mp4",
    area: "celebration",
    href: "#celebration",
    details: {
      description:
        "A joyful gathering to celebrate achievements, strengthen connections, and close the year as a community.",
    },
  },
];
