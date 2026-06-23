import type { Metadata } from "next";
import { Navbar } from "@/components/navbar";
import { ImageGallery } from "@/components/image-gallery";

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
          <div className="mx-auto max-w-5xl px-6 text-center">
            <h1
              id="gallery-page-heading"
              className="section-heading"
              style={{
                fontSize: "clamp(2.75rem, 6vw, 4.25rem)",
                color: "var(--orange)",
              }}
            >
              Gallery
            </h1>
            <p
              className="mx-auto mt-6 max-w-2xl text-lg font-semibold leading-relaxed"
              style={{ color: "var(--orange)" }}
            >
              Event photos and community highlights from our festivals,
              workshops, and gatherings.
            </p>
          </div>
          <ImageGallery />
        </section>
      </main>
    </>
  );
}
