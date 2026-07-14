import Link from "next/link";
import { ContentBrow } from "@/components/content-brow";
import { FileText, Download } from "lucide-react";
import { ArcGalleryHero } from "@/components/arc-gallery-hero";
import { SectionLogoHeading } from "@/components/section-logo-heading";
import { StackedCardBody, StackedCards } from "@/components/stacked-cards";
import { AboutSectionShell } from "@/components/about-flags-texture";
import { getGalleryPreviewUrls } from "@/lib/gallery-images";

export { EventsPageContent } from "@/components/events-section";

const CLOUDINARY_BASE = "https://res.cloudinary.com/daldas2e7/image/upload";

const UPDATE_IMAGES: string[] = [
  `${CLOUDINARY_BASE}/v1782010330/asosc/updates/updates-1.webp`,
  `${CLOUDINARY_BASE}/v1782010330/asosc/updates/updates-2.webp`,
  `${CLOUDINARY_BASE}/v1782010331/asosc/updates/updates-3.webp`,
  `${CLOUDINARY_BASE}/v1782755924/asosc/updates/certificate.webp`,
];

const SPONSOR_IMAGES: string[] = [
  `${CLOUDINARY_BASE}/v1782764734/asosc/sponsors/sevus.webp`,
  `${CLOUDINARY_BASE}/v1782764735/asosc/sponsors/canada.webp`,
  `${CLOUDINARY_BASE}/v1782764735/asosc/sponsors/alberta.webp`,
  `${CLOUDINARY_BASE}/v1782764736/asosc/sponsors/strathcona-county.webp`,
];

function getUpdateImages(): string[] {
  return UPDATE_IMAGES;
}

function getSponsorImages(): string[] {
  return SPONSOR_IMAGES;
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

export function AboutContent({ footer }: { footer?: React.ReactNode }) {
  return (
    <>
      <SectionLogoHeading id="about-heading">
        About Us
      </SectionLogoHeading>

      <StackedCards>
        <StackedCardBody
          videoSrc="https://res.cloudinary.com/daldas2e7/video/upload/v1782756282/asosc/videos/african-festival-optimized.mp4"
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
          videoSrc="https://res.cloudinary.com/daldas2e7/video/upload/v1782761786/asosc/videos/black-history-month-optimized.mp4"
          videoLabel="Black History Month celebration"
        >
          <h3 className="mb-4 text-(--orange-light)!">Our Vision</h3>
          <p className="text-(--orange-light)!">
            A vibrant, inclusive community where Africans contribute visibly
            to the social, economic, and cultural fabric of Strathcona County
            and Alberta.
          </p>
        </StackedCardBody>
      </StackedCards>
      {footer}
    </>
  );
}

export function AboutSection() {
  return (
    <AboutSectionShell id="about" aria-labelledby="about-heading">
      <AboutContent
        footer={
          <div className="about-section__cta flex justify-center pb-4">
            <Link
              href="/about#board"
              className="hero-cta-btn focus-ring-light inline-flex min-h-14 cursor-pointer items-center justify-center px-15 py-4 text-base font-semibold tracking-wide text-black transition duration-200 ease-out"
            >
              Learn More
            </Link>
          </div>
        }
      />
    </AboutSectionShell>
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
        <SectionLogoHeading id="documents-heading">
          Documents &amp; Reports
        </SectionLogoHeading>
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
      <SectionLogoHeading id="updates-heading">
        Updates
      </SectionLogoHeading>

      <div className="mx-auto max-w-4xl rounded-3xl border border-(--orange)/25 bg-black px-5 py-6 text-center shadow-2xl shadow-black/20 sm:px-8 sm:py-8">
        <ContentBrow theme="dark">February 2026</ContentBrow>
        <h3 className="mt-4 text-2xl font-bold text-(--cream-light) sm:text-3xl">
          CBC News Edmonton Feature
        </h3>
        <p className="mx-auto mt-4 max-w-3xl text-base leading-relaxed text-(--cream)/85 sm:text-lg">
          CBC News Edmonton features the founder of ASOSC, Busayo Disu, on Edmonton AM to discuss
          how Strathcona County is celebrating its first Black History Month,
          and to talk about her new documentary series, "Our Story, Our Voice."
        </p>

        <div className="mt-7 overflow-hidden rounded-2xl border border-(--cream-light)/15 bg-black shadow-xl shadow-black/30">
          <div className="relative aspect-video w-full">
            <iframe
              className="absolute inset-0 h-full w-full"
              src="https://www.youtube.com/embed/WCMRMos38AM?si=P0-7dpw59P4iw0pv"
              title="YouTube video player"
              frameBorder="0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              referrerPolicy="strict-origin-when-cross-origin"
              allowFullScreen
            />
          </div>
        </div>

        <div className="mt-7 flex justify-center">
          <a
            href="https://www.cbc.ca/player/play/video/9.7106403"
            target="_blank"
            rel="noopener noreferrer"
            className="hero-cta-btn focus-ring-light inline-flex min-h-12 cursor-pointer items-center justify-center px-8 py-3 text-sm font-semibold tracking-wide text-black transition duration-200 ease-out"
          >
            View Article
          </a>
        </div>
      </div>

      <div className="mx-auto mt-8 max-w-3xl rounded-3xl border border-(--brown-dark)/10 bg-(--cream)/60 px-6 py-8 text-center sm:px-10 sm:py-10">
        <ContentBrow>February 2026</ContentBrow>
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

export function SponsorsSection() {
  const images = getSponsorImages();

  return (
    <section
      id="sponsors"
      className="section-shell bg-(--cream-light)"
      aria-labelledby="sponsors-heading"
    >
      <SectionLogoHeading id="sponsors-heading">
        Sponsors
      </SectionLogoHeading>

      <div className="mx-auto max-w-3xl rounded-3xl border border-(--brown-dark)/10 bg-(--cream)/60 px-6 py-8 text-center sm:px-10 sm:py-10">
        <ContentBrow>Community Partners</ContentBrow>
        <h3 className="mt-4 text-2xl font-bold text-black sm:text-3xl">
          Thank You To Our Sponsors
        </h3>
        <p className="mt-4 text-lg leading-relaxed text-black/80">
          Thank you to the partners who help make ASOSC programs, events, and
          community initiatives possible.
        </p>
      </div>

      {images.length > 0 && (
        <div className="sponsors-arc mt-12" aria-hidden="false">
          <div className="sponsors-arc__pivot">
            {/* Four loops around the circle — tight enough to feel full, loose enough not to overlap. */}
            {Array.from({ length: 4 }, (_, repeat) =>
              images.map((file, index) => {
                const itemIndex = repeat * images.length + index;
                const angle = itemIndex * (360 / (images.length * 4));
                return (
                  <div
                    key={`${file}-${itemIndex}`}
                    className="sponsors-arc__item"
                    style={{ "--arc-angle": `${angle}deg` } as React.CSSProperties}
                  >
                    <img
                      src={file}
                      alt=""
                      className="max-h-full max-w-full object-contain"
                      loading="eager"
                    />
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </section>
  );
}
