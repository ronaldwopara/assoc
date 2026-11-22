"use client";

import { InteractiveBentoGallery } from "@/components/interactive-bento-gallery";
import type { MediaItemType } from "@/lib/featured-programs-data";
import { useSiteContent } from "@/components/site-content-provider";

/** Where each tile's navbar link scrolls to. */
const ANCHORS: Record<MediaItemType["area"], string> = {
  story: "#our-story",
  youth: "#youth-lab",
  festival: "#festival",
  bhm: "#bhm",
  wellness: "#wellness",
  celebration: "#celebration",
};

export function FeaturedPrograms() {
  const { programs } = useSiteContent();
  const featuredProgramsMedia: MediaItemType[] = programs.items.map((p, i) => ({
    id: i + 1,
    type: "video",
    title: p.title,
    desc: p.desc,
    url: p.video,
    area: p.area,
    href: ANCHORS[p.area],
    details: {
      description: p.description,
      sections: p.blocks
        .filter((b) => b.heading || b.bullets.length || b.body)
        .map((b) => (b.bullets.length ? { heading: b.heading, bullets: b.bullets } : { heading: b.heading, body: b.body })),
    },
  }));
  return (
    <section
      id="programs"
      className="section-shell bg-black relative !py-12 !pb-16 sm:!py-16 sm:!pb-20 lg:!py-20 lg:!pb-24 border-b-4 border-black"
      aria-labelledby="featured-programs-heading"
    >
      <div className="relative z-10">
        <InteractiveBentoGallery
          mediaItems={featuredProgramsMedia}
          title={programs.title}
          description={programs.intro}
        />
        {/* Scroll anchors for navbar program links */}
        <div className="h-0 overflow-hidden" aria-hidden>
          {featuredProgramsMedia.map((item) => (
            <div
              key={item.href}
              id={item.href.replace("#", "")}
              className="scroll-mt-28"
            />
          ))}
        </div>
      </div>
    </section>
  );
}
