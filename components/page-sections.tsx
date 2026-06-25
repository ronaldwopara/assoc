import Link from "next/link";
import { FileText, Download } from "lucide-react";
import { ArcGalleryHero } from "@/components/arc-gallery-hero";
import { StackedCardBody, StackedCards } from "@/components/stacked-cards";
import { getGalleryPreviewUrls } from "@/lib/gallery-images";

export { CalendarSection } from "@/components/calendar-section";

const CLOUDINARY_BASE = "https://res.cloudinary.com/daldas2e7/image/upload";

const UPDATE_IMAGES: string[] = [
  `${CLOUDINARY_BASE}/v1782010330/asosc/updates/updates-1.webp`,
  `${CLOUDINARY_BASE}/v1782010330/asosc/updates/updates-2.webp`,
  `${CLOUDINARY_BASE}/v1782010331/asosc/updates/updates-3.webp`,
  `${CLOUDINARY_BASE}/v1782010334/asosc/updates/updates-4.webp`,
];

function getUpdateImages(): string[] {
  return UPDATE_IMAGES;
}

interface DocumentItem {
  label: string;
  href: string;
}

interface DocumentGroup {
  title: string;
  items: DocumentItem[];
}

const documentGroups: DocumentGroup[] = [
  {
    title: "Financial Reports",
    items: [
      { label: "2025 Financial Statement", href: "/docs/2025/Financial-Statement-2025.pdf" },
      { label: "2024 Financial Statement", href: "/docs/2024/ASOSC-Financial-Statement-2024.pdf" },
      { label: "2023 Financial Statement", href: "/docs/2023/ASOSC-Financial-Statement-2023.pdf" },
    ],
  },
  {
    title: "Governance & Planning",
    items: [
      { label: "Bylaws (2025)", href: "/docs/governance/Bylaws-2025.docx" },
      { label: "Strategic Plan", href: "/docs/governance/ASOSC-Strategic-Plan.pptx" },
    ],
  },
];

function CardBullet({ children }: { children: React.ReactNode }) {
  return (
    <li className="stacked-card__bullet">
      <span className="stacked-card__bullet-dot" aria-hidden="true" />
      <span>{children}</span>
    </li>
  );
}

export function AboutContent() {
  return (
    <>
      <h2 id="about-heading" className="mb-6 text-center text-[clamp(2.5rem,6vw,4.5rem)] font-bold tracking-wide text-(--orange)">
        About Us
      </h2>

      <StackedCards>
        <StackedCardBody
          videoSrc="/African-festival.mp4"
          videoLabel="African Festival community celebration"
        >
          <h3 className="mb-4">Our Mission</h3>
          <ul className="stacked-card__list">
            <CardBullet>
              To organize community events and initiatives that celebrate
              African culture
            </CardBullet>
            <CardBullet>
              To educate the broader community about the heritage and lived
              realities of Africans
            </CardBullet>
            <CardBullet>
              To provide capacity-building opportunities that empower African
              youth and families to thrive socially, culturally, and
              economically.
            </CardBullet>
          </ul>
        </StackedCardBody>

        <StackedCardBody
          videoSrc="/Youth-Creative-Media-Lab.mp4"
          videoLabel="Youth Creative Lab program"
        >
          <h3 className="mb-4 text-(--orange-light)!">Our Vision</h3>
          <p className="text-(--orange-light)!">
            A vibrant, inclusive community where Africans contribute visibly
            to the social, economic, and cultural fabric of Strathcona County
            and Alberta.
          </p>
        </StackedCardBody>
      </StackedCards>
    </>
  );
}

export function AboutSection() {
  return (
    <section
      id="about"
      className="section-shell bg-(--cream-light)"
      aria-labelledby="about-heading"
    >
      <AboutContent />

      <div className="about-section__cta flex justify-center pb-4">
        <Link
          href="/about#board"
          className="hero-cta-btn focus-ring-light inline-flex min-h-14 cursor-pointer items-center justify-center px-15 py-4 text-base font-semibold tracking-wide text-black transition duration-200 ease-out"
        >
          Learn More
        </Link>
      </div>
    </section>
  );
}

export function GallerySection() {
  const galleryImages = getGalleryPreviewUrls();

  return <ArcGalleryHero images={galleryImages} />;
}

export function PageSections() {
  return (
    <>
      <GallerySection />
    </>
  );
}

export function DocumentsSection() {
  return (
    <section
      className="section-shell bg-(--cream-light)"
      aria-labelledby="documents-heading"
    >
      <div className="supplemental mx-auto max-w-3xl text-center">
        <h2 id="documents-heading" className="mb-6 whitespace-nowrap text-center text-[clamp(1.5rem,8vw,4rem)] font-bold tracking-wide text-(--orange)">
          Documents &amp; Reports
        </h2>
        <div className="section-lead mx-auto">
          Annual financial statements, our bylaws, and our strategic plan are
          available below for download.
        </div>
      </div>

      <div className="mx-auto mt-12 grid max-w-3xl gap-10 md:grid-cols-2">
        {documentGroups.map((group) => (
          <div key={group.title}>
            <h3 className="mb-4 text-lg font-bold uppercase tracking-wide text-(--orange)">
              {group.title}
            </h3>
            <div className="flex flex-col gap-3">
              {group.items.map((item) => (
                <a
                  key={item.href}
                  href={item.href}
                  download
                  className="focus-ring-light group flex items-center justify-between gap-4 rounded-2xl border border-(--brown-dark)/10 bg-(--cream)/60 px-5 py-4 transition-colors duration-200 hover:bg-(--hero-cta)/15"
                >
                  <span className="flex items-center gap-3">
                    <FileText className="h-5 w-5 shrink-0 text-black/60" />
                    <span className="font-medium text-black">
                      {item.label}
                    </span>
                  </span>
                  <Download className="h-5 w-5 shrink-0 text-black/60 transition-colors duration-200 group-hover:text-black" />
                </a>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

export function UpdatesSection() {
  const images = getUpdateImages();
  // Triple so the seamless loop never visibly resets
  const galleryImages = images.length > 0 ? [...images, ...images, ...images] : [];

  return (
    <section
      id="updates"
      className="section-shell bg-(--cream-light)"
      aria-labelledby="updates-heading"
    >
      <h2 id="updates-heading" className="mb-6 text-center text-[clamp(2.5rem,6vw,4.5rem)] font-bold tracking-wide text-(--orange)">
        Updates
      </h2>

      <div className="mx-auto max-w-3xl rounded-3xl border border-(--brown-dark)/10 bg-(--cream)/60 px-6 py-8 text-center sm:px-10 sm:py-10">
        <span className="inline-block rounded-full bg-(--hero-cta)/20 px-4 py-1 text-sm font-bold uppercase tracking-wide text-black">
          February 2026
        </span>
        <h3 className="mt-4 text-2xl font-bold text-black sm:text-3xl">
          Black History Month
        </h3>
        <p className="mt-4 text-lg leading-relaxed text-black/80">
          For the first time, Strathcona County officially declared
          Black History Month celebration in February 2026,
          recognizing the contributions, culture, and resilience of
          Black communities while supporting inclusive community
          initiatives.
        </p>
      </div>

      {galleryImages.length > 0 && (
        <div className="updates-marquee mt-12">
          <div className="updates-marquee__track">
            {galleryImages.map((file, index) => (
              <div
                key={`${file}-${index}`}
                className="updates-marquee__item h-48 w-48 shrink-0 overflow-hidden rounded-xl border border-(--brown-dark)/10 shadow-lg shadow-black/10 transition-transform duration-300 hover:scale-105 md:h-64 md:w-64 lg:h-72 lg:w-72"
              >
                <img
                  src={file}
                  alt=""
                  className="h-full w-full object-cover"
                  loading="eager"
                />
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
