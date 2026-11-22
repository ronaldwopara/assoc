import { featuredProgramsMedia } from "@/lib/featured-programs-data";
import { eventActionLinks, upcomingEvents } from "@/lib/events-data";
import type { SiteContent } from "@/lib/site-content/types";

/** What the site showed before staff could edit it. Used until the first save. */

const C = "https://res.cloudinary.com/daldas2e7/image/upload";
const BOARD = `${C}/c_fill,g_face,w_600,h_800,f_webp,q_auto`;

export function buildSeedSiteContent(): SiteContent {
  return {
    updatedAt: new Date(0).toISOString(),
    hero: {
      headline: "AFRICANS SOCIETY OF STRATHCONA COUNTY",
      subheadline:
        "Empowering Africans to enrich the social, economic, and cultural fabric of Strathcona County and beyond",
      primaryButton: "Join Our Community",
      secondaryButton: "Explore Our Programs",
      slides: [
        { src: `${C}/v1782010316/asosc/caurosel/1-c.webp`, alt: "Community members gathered together at an ASOSC event" },
        { src: `${C}/v1782010318/asosc/caurosel/2-c.webp`, alt: "Group portrait celebrating in vibrant traditional attire" },
        { src: `${C}/v1782010319/asosc/caurosel/3-c.webp`, alt: "Friends posing together in colourful festival dress" },
        { src: `${C}/v1782010319/asosc/caurosel/4-c.webp`, alt: "A large community gathering in the park" },
        { src: `${C}/v1782010321/asosc/caurosel/5-c.webp`, alt: "Friends posing together on the grass at a summer event" },
        { src: `${C}/v1782010321/asosc/caurosel/6-c.webp`, alt: "Children with painted faces enjoying a community picnic" },
      ],
    },
    about: {
      mission: [
        "To educate the broader community about the heritage and lived realities of Africans",
        "To organize community events and initiatives that celebrate African culture",
        "To provide capacity-building opportunities that empower African youth and families to thrive socially, culturally, and economically.",
      ],
      vision:
        "A vibrant, inclusive community where Africans contribute visibly to the social, economic, and cultural fabric of Strathcona County and Alberta.",
      values: [
        { title: "Excellence & Innovation", text: "We hold our programs to a high standard and keep looking for better, more creative ways to serve our community." },
        { title: "Community Engagement", text: "We build with our community, not for it. The people we serve shape what we do and how we do it." },
        { title: "Integrity & Accountability", text: "We are honest about our commitments and answerable for our results, to our members and to those who support us." },
        { title: "Inclusion & Belonging", text: "Everyone is welcome. We build spaces where people feel seen, valued and at home." },
        { title: "Cultural Pride", text: "We celebrate African heritage openly and help the next generation carry it forward with confidence." },
      ],
      images: [
        `${C}/v1782010316/asosc/caurosel/1-c.webp`,
        `${C}/v1782010318/asosc/caurosel/2-c.webp`,
        `${C}/v1782010319/asosc/caurosel/3-c.webp`,
      ],
    },
    programs: {
      title: "Our Programs",
      intro: "We believe storytelling, cultural pride and community engagement are powerful tools for change.",
      items: featuredProgramsMedia.map((m) => ({
        area: m.area,
        title: m.title,
        desc: m.desc,
        video: m.url,
        description: m.details?.description ?? "",
        blocks: (m.details?.sections ?? []).map((s) => ({ heading: s.heading, bullets: s.bullets ?? [], body: s.body ?? "" })),
      })),
    },
    actions: {
      volunteer: {
        eyebrow: "Get Involved",
        title: "Help Build Community With Us",
        body: "Share your time, skills, and energy at ASOSC events, programs, workshops, and community initiatives across Strathcona County.",
        button: "Volunteer With Us",
      },
      donate: {
        eyebrow: "Support The Work",
        title: "Invest In Programs That Serve Families",
        body: "Your contribution helps fund cultural celebrations, youth programming, wellness sessions, storytelling projects, and community outreach.",
        button: "Donate Today",
      },
      events: {
        eyebrow: "Show Up & Celebrate",
        title: "Find Your Place At Our Next Gathering",
        body: "From the African Festival to Black History Month, wellness sessions, and youth programs — explore what's coming up across Strathcona County and take part.",
        button: "Get Involved",
      },
      membership: {
        eyebrow: "Join ASOSC",
        title: "Become Part Of The Society",
        body: "Membership helps strengthen our voice, grow our programs, and connect African families, allies, and partners.",
        button: "Become A Member",
      },
      vendor: {
        eyebrow: "Partner With Us",
        title: "Register As A Vendor",
        body: "Showcase your business, art, craft and services at ASOSC's festivals and community events.",
        button: "Register",
      },
      contact: {
        eyebrow: "Reach Out",
        title: "Start A Conversation With Us",
        body: "Have a question, partnership idea, or community opportunity? Send us a message and we will connect with you.",
        button: "Contact Us",
      },
    },
    events: upcomingEvents.map((e) => ({
      title: e.title,
      badge: e.badge,
      location: e.location,
      when: e.when,
      video: e.videoSrc,
      href: e.href,
      actionLabel: eventActionLinks[e.title]?.label ?? "",
      actionHref: eventActionLinks[e.title]?.href ?? "",
    })),
    updates: {
      items: [
        {
          date: "February 2026",
          title: "CBC News Edmonton Feature",
          text: "CBC News Edmonton features the founder of ASOSC, Busayo Disu, on Edmonton AM to discuss how Strathcona County is celebrating its first Black History Month, and to talk about her new documentary series, “Our Story, Our Voice.”",
          video: "https://www.youtube.com/watch?v=WCMRMos38AM",
          linkLabel: "View Article",
          linkHref: "https://www.cbc.ca/player/play/video/9.7106403",
          dark: true,
        },
        {
          date: "February 2026",
          title: "Black History Month",
          text: "For the first time, Strathcona County officially declared Black History Month celebration in February 2026, recognizing the contributions, culture, and resilience of Black communities while supporting inclusive community initiatives.",
          video: "",
          linkLabel: "",
          linkHref: "",
          dark: false,
        },
      ],
      photos: [
        `${C}/v1782010330/asosc/updates/updates-1.webp`,
        `${C}/v1782010330/asosc/updates/updates-2.webp`,
        `${C}/v1782010331/asosc/updates/updates-3.webp`,
        `${C}/v1782755924/asosc/updates/certificate.webp`,
      ],
    },
    sponsors: {
      eyebrow: "Community Partners",
      title: "Thank You To Our Sponsors",
      text: "Thank you to the partners who help make ASOSC programs, events, and community initiatives possible.",
      logos: [
        `${C}/v1782764734/asosc/sponsors/sevus.webp`,
        `${C}/v1784895521/asosc/sponsors/pembina.webp`,
        `${C}/v1784895521/asosc/sponsors/synergy-fa-care-clin.webp`,
        `${C}/v1782764735/asosc/sponsors/canada.webp`,
        `${C}/v1782764735/asosc/sponsors/alberta.webp`,
        `${C}/v1782764736/asosc/sponsors/strathcona-county.webp`,
      ],
    },
    board: [
      { designation: "Founder/President", name: "Busayo Disu", src: `${BOARD}/v1783629200/asosc/board/busayo-disu.jpg` },
      { designation: "Treasurer", name: "Bose Osa-Izeko", src: `${BOARD}/v1783629201/asosc/board/bose-osa-izeko.jpg` },
      { designation: "Director", name: "Omoniyi Fabarebo", src: `${BOARD}/v1783629202/asosc/board/omoniyi-fabarebo.jpg` },
      { designation: "Director at Large", name: "Kayode Disu", src: `${BOARD}/v1783629202/asosc/board/kayode-disu.jpg` },
      { designation: "Director at Large", name: "Temitope Haastrup", src: `${BOARD}/v1783629203/asosc/board/temitope-haastrup.jpg` },
    ],
    contact: {
      email: "info@asosc.ca",
      phone: "(587) 566-3212",
      facebook:
        "https://www.facebook.com/people/Africans-Society-of-Strathcona-County/61550552301286/?mibextid=wwXIfr&rdid=JKQw6RpiLSmQFyry&share_url=https%3A%2F%2Fwww.facebook.com%2Fshare%2F156xwBzZdx%2F%3Fmibextid%3DwwXIfr%26ref%3D1",
      instagram: "https://www.instagram.com/africansocietystrathconacounty?igsh=MmdwOTJrYWE3N2Jv&utm_source=qr",
    },
  };
}
