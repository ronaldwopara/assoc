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
    url: "/our-story.mp4",
    area: "story",
    href: "#our-story",
    details: {
      description:
        "Our Story, Our Voice is a powerful storytelling platform that shares the lived experiences of African immigrants in Canada through books, film, podcasts and community dialogue.",
      sections: [
        {
          heading: "What We Offer",
          bullets: [
            "Book: Our Story, Our Voice (available for purchase)",
            "Documentary series (annual releases)",
            "Public screenings and discussions",
            "Podcasts",
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
    title: "Youth Creative Media Lab",
    desc: "Raising the next generation of African leaders.",
    url: "/Youth-Creative-Media-Lab.mp4",
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
    title: "African Festival (Annual – August)",
    desc: "Celebrating culture. Connecting community.",
    url: "/African-Festival.mp4",
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
    title: "Black History Month (Annual – February)",
    desc: "Honoring heritage and celebrating achievements.",
    url: "/black-history-month.mp4",
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
    title: "Family Wellness Seminars",
    desc: "Supporting strong communities and healthy African families.",
    url: "/Family-Wellness-Seminars.mp4",
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
    title: "Annual End-of-Year Celebration",
    desc: "Celebrating togetherness.",
    url: "/Annual-End-of-Year-Celebration.mp4",
    area: "celebration",
    href: "#celebration",
    details: {
      description:
        "A joyful gathering to celebrate achievements, strengthen connections, and close the year as a community.",
    },
  },
];
