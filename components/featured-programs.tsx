"use client";

import { InteractiveBentoGallery } from "@/components/interactive-bento-gallery";
import { featuredProgramsMedia } from "@/lib/featured-programs-data";

export function FeaturedPrograms() {
  return (
    <section
      id="programs"
      className="section-shell bg-[var(--cream)] !py-12 !pb-16 sm:!py-16 sm:!pb-20 lg:!py-20 lg:!pb-24 border-b-4 border-[var(--brown-dark)]"
      aria-labelledby="featured-programs-heading"
    >
      <InteractiveBentoGallery
        mediaItems={featuredProgramsMedia}
        title="Featured Programs"
        description="We believe storytelling, cultural pride and community engagement are powerful tools for change."
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
    </section>
  );
}
