import type { Metadata } from "next";
import { Suspense } from "react";
import { Navbar } from "@/components/navbar";
import { GalleryPageContent } from "@/components/gallery-page-content";
import { SectionLogoHeading } from "@/components/section-logo-heading";

export const metadata: Metadata = {
  title: "Gallery",
  description:
    "Event photos and community highlights from ASOSC festivals, workshops, and gatherings.",
};

export default function GalleryPage() {
  return (
    <>
      <Navbar />
      <main id="main-content" className="site-main">
        <section
          className="section-shell bg-(--cream-light)"
          aria-labelledby="gallery-page-heading"
        >
          <div className="mx-auto max-w-5xl px-5 pt-2 text-center sm:px-6 sm:pt-0">
            <SectionLogoHeading
              id="gallery-page-heading"
              as="h1"
            >
              Gallery
            </SectionLogoHeading>
            <p
              className="mx-auto mt-3 max-w-md text-base font-semibold leading-relaxed sm:mt-6 sm:max-w-2xl sm:text-lg"
              style={{ color: "var(--orange)" }}
            >
              Event photos and community highlights from our festivals,
              workshops, and gatherings.
            </p>
          </div>
          <Suspense fallback={null}>
            <GalleryPageContent />
          </Suspense>
        </section>
      </main>
    </>
  );
}
