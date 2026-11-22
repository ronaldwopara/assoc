/**
 * What a licence is, what it costs, and what it opens. Safe to import from
 * client components: nothing here is secret.
 *
 * One licence opens every Our Story, Our Voice documentary on the site
 * (staff add them under Upgrade → Documentaries). The tiers are sized by how many
 * people it covers. Prices and Payment Links live in the ASOSC live Stripe account (product prod_Vd5rfQeFUNLkGO, all CAD, all
 * auto-renewing). Change a price in Stripe and change it here too: the figure
 * shown on the card has to match what the link charges.
 */

export type LicenceTerm = "month" | "year";

export type LicenceTier = {
  id: "individual" | "school" | "multi" | "division" | "extended";
  name: string;
  /** Who it covers, in plain words. */
  covers: string;
  /** Dollars per term; absent for a custom quote. */
  prices: Partial<Record<LicenceTerm, number>>;
  /** Stripe Payment Link per term. */
  links: Partial<Record<LicenceTerm, string>>;
};

export const LICENCE_TIERS: LicenceTier[] = [
  {
    id: "individual",
    name: "Individual",
    covers: "One user",
    prices: { month: 20, year: 150 },
    links: {
      month: "https://buy.stripe.com/eVqdR99D7dWv198899eAg0a",
      year: "https://buy.stripe.com/28E7sL5mRbOn3hg2OPeAg0b",
    },
  },
  {
    id: "school",
    name: "Single school or small organization",
    covers: "Up to 50 users",
    prices: { year: 750 },
    links: { year: "https://buy.stripe.com/3cIdR95mRcSrbNMfBBeAg0c" },
  },
  {
    id: "multi",
    name: "Multiple schools or large organization",
    covers: "51 to 200 users",
    prices: { year: 2000 },
    links: { year: "https://buy.stripe.com/3cI4gzcPjg4D198dtteAg0d" },
  },
  {
    id: "division",
    name: "School division",
    covers: "200+ users",
    prices: { year: 5000 },
    links: { year: "https://buy.stripe.com/dRmdR95mRaKj2dcexxeAg0e" },
  },
  {
    id: "extended",
    name: "Extended use and special licensing",
    covers: "Broader use beyond standard educational access",
    prices: {},
    links: {},
  },
];

/**
 * The live Payment Link ids behind LICENCE_TIERS. The webhook uses these to
 * tell a licence sale from a membership or donation.
 */
export const LICENCE_PAYMENT_LINK_IDS: Record<string, { tier: LicenceTier["id"]; term: LicenceTerm }> = {
  plink_1Ubpg9Dl7DjwPQrVYpWOD01a: { tier: "individual", term: "month" },
  plink_1UbpgADl7DjwPQrVyWm24O6i: { tier: "individual", term: "year" },
  plink_1UbpgADl7DjwPQrVel5g2sOJ: { tier: "school", term: "year" },
  plink_1UbpgBDl7DjwPQrVs6NnAeO1: { tier: "multi", term: "year" },
  plink_1UbpgCDl7DjwPQrVsXtOG3gn: { tier: "division", term: "year" },
};

export function tierById(id: string): LicenceTier | undefined {
  return LICENCE_TIERS.find((t) => t.id === id);
}

export type Story = {
  /** Stable id used in /api/licence/watch?story=… — never changes once made. */
  id: string;
  title: string;
  /** Short line under the title. */
  theme: string;
  /** One line shown first. */
  summary: string;
  /** The longer description, shown on "Read more". */
  hook: string;
  /** A local /images path or a Cloudinary URL. Landscape, 3:2. */
  cover: string;
  /**
   * Bunny Stream video ids. Not secret on their own: playback is protected by
   * token authentication on the library, signed server-side. A blank film
   * shows "not available yet"; a blank trailer is skipped.
   */
  videoId: string;
  trailerId: string;
  /** Shown on the Stories page. Off keeps it saved but hidden. */
  published: boolean;
};

/**
 * The first documentary, used until staff save the list from the dashboard.
 * The live list is in lib/documentaries.
 */
export const SEED_STORIES: Story[] = [
  {
    id: "walking-in-their-shoes",
    title: "Walking in Their Shoes",
    theme: "Our Story, Our Voice documentary",
    summary: "Real stories of African and Black immigrants building a life in Canada.",
    hook: "A powerful documentary sharing the lived experiences of African and Black immigrants in Canada. Through real stories of resilience, identity and belonging, the film encourages empathy, cultural understanding, inclusion and meaningful conversations about the realities of being Black in Canada.",
    cover: "/images/stories/walking-in-their-shoes.webp",
    // Bunny: "OSOV-Valueboard- Subtitled.mp4" (18 min) and "Our Story Our Voice -AdetolaTrailer.mp4".
    videoId: "187eaa09-d85a-4885-bae5-775ef158e72f",
    trailerId: "c9fac500-137f-4897-a172-3e3570c8a062",
    published: true,
  },
];
