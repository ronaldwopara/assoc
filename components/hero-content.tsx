"use client";

import Link from "next/link";

const HEADLINE = "AFRICANS SOCIETY OF STRATHCONA COUNTY";
const SUBHEADLINE =
  "Empowering Africans to enrich the social, economic, and cultural fabric of Strathcona County and beyond";

const ctaClassName =
  "hero-cta-btn focus-ring-light inline-flex min-h-14 cursor-pointer items-center justify-center px-10 py-4 text-base font-semibold tracking-wide text-black transition duration-200 ease-out";

export function HeroContent() {
  return (
    <div className="absolute inset-0 z-10 flex flex-col items-start justify-center px-6 text-left text-white sm:px-12 lg:px-16 xl:px-24">
      <div className="max-w-4xl">
        <h1 className="text-[clamp(1.75rem,5vw,3.75rem)] font-bold uppercase leading-[1.1] tracking-wide text-white drop-shadow-[0_1px_8px_rgba(0,0,0,0.45)]">
          {HEADLINE}
        </h1>

        <div
          className="mt-6 max-w-[42rem] text-lg font-normal leading-relaxed text-white/95 sm:text-xl"
          role="doc-subtitle"
        >
          {SUBHEADLINE}
        </div>

        <div className="mt-8 flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-center">
          <Link href="#programs" className={ctaClassName}>
            Explore Our Programs
          </Link>
          <Link href="#get-involved" className={ctaClassName}>
            Join Our Community
          </Link>
        </div>
      </div>
    </div>
  );
}
