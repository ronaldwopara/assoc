"use client";

import Link from "next/link";
import { ContentBrow } from "@/components/content-brow";
import { FileText, Download } from "lucide-react";
import { ArcGalleryHero } from "@/components/arc-gallery-hero";
import { SectionLogoHeading } from "@/components/section-logo-heading";
import { StackedCardBody, StackedCards } from "@/components/stacked-cards";
import { AboutSectionShell } from "@/components/about-section-shell";
import { MediaPlaceholderImage } from "@/components/media-placeholder";
import { useGalleryCms } from "@/components/gallery-cms-provider";
import { getGalleryPreviewUrlsFromCms } from "@/lib/gallery-cms/helpers";
import type { DocumentsCmsData } from "@/lib/documents-cms/types";
import { toPublicDocumentHref } from "@/lib/documents-cms/helpers";
import { useSiteContent } from "@/components/site-content-provider";
import { youtubeEmbedUrl } from "@/lib/site-content/normalize";

export { EventsPageContent } from "@/components/events-section";

interface DocumentItem {
  label: string;
  href: string;
}

interface DocumentGroup {
  title: string;
  items: DocumentItem[];
}

function documentsCmsToGroups(data: DocumentsCmsData): DocumentGroup[] {
  return data.groups.map((group) => ({
    title: group.title,
    items: group.items.map((item) => ({
      label: item.label,
      href: toPublicDocumentHref(item.url),
    })),
  }));
}

function CardBullet({ children }: { children: React.ReactNode }) {
  return (
    <li className="stacked-card__bullet">
      <span className="stacked-card__bullet-dot" aria-hidden="true" />
      <span>{children}</span>
    </li>
  );
}

export function AboutContent({
  footer,
  priorityFirstImage = false,
}: {
  footer?: React.ReactNode;
  /** True when this renders above the fold (the /about page) so the first
   *  card's image is fetched eagerly rather than lazily. */
  priorityFirstImage?: boolean;
}) {
  const { about } = useSiteContent();
  return (
    <>
      <SectionLogoHeading id="about-heading">
        About Us
      </SectionLogoHeading>

      <StackedCards>
        <StackedCardBody
          imageSrc={about.images[0] ?? ""}
          imageAlt="Community members gathered together at an ASOSC event"
          mediaTone="orange"
          priority={priorityFirstImage}
        >
          <h3 className="mb-4">Our Mission</h3>
          <ul className="stacked-card__list">
            {about.mission.map((line, i) => (
              <CardBullet key={i}>{line}</CardBullet>
            ))}
          </ul>
        </StackedCardBody>

        <StackedCardBody
          imageSrc={about.images[1] ?? ""}
          imageAlt="Group portrait celebrating in vibrant traditional attire"
          mediaTone="ink"
        >
          <h3 className="mb-4 text-(--orange-light)!">Our Vision</h3>
          <p className="text-(--orange-light)!">{about.vision}</p>
        </StackedCardBody>

        <StackedCardBody
          imageSrc={about.images[2] ?? ""}
          imageAlt="Friends posing together in colourful festival dress"
          mediaTone="orange"
        >
          <h3 className="mb-4">Our Values</h3>
          <ul className="stacked-card__list">
            {about.values.map((v, i) => (
              <CardBullet key={i}>
                {v.title && <strong>{v.title}:</strong>} {v.text}
              </CardBullet>
            ))}
          </ul>
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
  const cms = useGalleryCms();
  const galleryImages = getGalleryPreviewUrlsFromCms(cms);

  return <ArcGalleryHero images={galleryImages} />;
}

export function PageSections() {
  return (
    <>
      <GallerySection />
    </>
  );
}

export function DocumentsSection({
  documentsData,
}: {
  documentsData: DocumentsCmsData;
}) {
  const documentGroups = documentsCmsToGroups(documentsData);

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
                  key={`${group.title}-${item.href}`}
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
  const { updates } = useSiteContent();
  const images = updates.photos.filter(Boolean);
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

      {updates.items.map((item, i) => {
        const embed = item.video ? youtubeEmbedUrl(item.video) : "";
        return item.dark ? (
          <div
            key={i}
            className={`mx-auto max-w-4xl rounded-3xl border border-(--orange)/25 bg-black px-5 py-6 text-center shadow-2xl shadow-black/20 sm:px-8 sm:py-8${i > 0 ? " mt-8" : ""}`}
          >
            {item.date && <ContentBrow theme="dark">{item.date}</ContentBrow>}
            <h3 className="mt-4 text-2xl font-bold text-(--cream-light) sm:text-3xl">{item.title}</h3>
            {item.text && (
              <p className="mx-auto mt-4 max-w-3xl text-base leading-relaxed text-(--cream)/85 sm:text-lg">{item.text}</p>
            )}
            {embed && (
              <div className="mt-7 overflow-hidden rounded-2xl border border-(--cream-light)/15 bg-black shadow-xl shadow-black/30">
                <div className="relative aspect-video w-full">
                  <iframe
                    className="absolute inset-0 h-full w-full"
                    src={embed}
                    title={item.title}
                    frameBorder="0"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                    referrerPolicy="strict-origin-when-cross-origin"
                    allowFullScreen
                  />
                </div>
              </div>
            )}
            {item.linkHref && (
              <div className="mt-7 flex justify-center">
                <a
                  href={item.linkHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hero-cta-btn focus-ring-light inline-flex min-h-12 cursor-pointer items-center justify-center px-8 py-3 text-sm font-semibold tracking-wide text-black transition duration-200 ease-out"
                >
                  {item.linkLabel || "Read more"}
                </a>
              </div>
            )}
          </div>
        ) : (
          <div
            key={i}
            className={`mx-auto max-w-3xl rounded-3xl border border-(--brown-dark)/10 bg-(--cream)/60 px-6 py-8 text-center sm:px-10 sm:py-10${i > 0 ? " mt-8" : ""}`}
          >
            {item.date && <ContentBrow>{item.date}</ContentBrow>}
            <h3 className="mt-4 text-2xl font-bold text-black sm:text-3xl">{item.title}</h3>
            {item.text && <p className="mt-4 text-lg leading-relaxed text-black/80">{item.text}</p>}
            {embed && (
              <div className="mt-7 overflow-hidden rounded-2xl">
                <div className="relative aspect-video w-full">
                  <iframe
                    className="absolute inset-0 h-full w-full"
                    src={embed}
                    title={item.title}
                    frameBorder="0"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                    referrerPolicy="strict-origin-when-cross-origin"
                    allowFullScreen
                  />
                </div>
              </div>
            )}
            {item.linkHref && (
              <div className="mt-7 flex justify-center">
                <a
                  href={item.linkHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hero-cta-btn focus-ring-light inline-flex min-h-12 cursor-pointer items-center justify-center px-8 py-3 text-sm font-semibold tracking-wide text-black transition duration-200 ease-out"
                >
                  {item.linkLabel || "Read more"}
                </a>
              </div>
            )}
          </div>
        );
      })}

      {galleryImages.length > 0 && (
        <div className="updates-marquee mt-12">
          <div className="updates-marquee__track">
            {galleryImages.map((file, index) => (
              <div
                key={`${file}-${index}`}
                className="updates-marquee__item h-48 w-48 shrink-0 overflow-hidden rounded-xl border border-(--brown-dark)/10 shadow-lg shadow-black/10 transition-transform duration-300 hover:scale-105 md:h-64 md:w-64 lg:h-72 lg:w-72"
              >
                <MediaPlaceholderImage
                  src={file}
                  alt=""
                  tone="cream"
                  loading="eager"
                  className="h-full w-full object-cover"
                  wrapperClassName="h-full w-full"
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
  const { sponsors } = useSiteContent();
  const images = sponsors.logos.filter(Boolean);
  // Original design: 4 logos × 4 loops = 16 slots at 22.5°. Keep that
  // geometry fixed and cycle the roster through the slots so spacing never
  // changes when sponsors are added or removed.
  const ARC_STEP_DEG = 22.5;
  const ARC_SLOT_COUNT = Math.round(360 / ARC_STEP_DEG);

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
        <ContentBrow>{sponsors.eyebrow}</ContentBrow>
        <h3 className="mt-4 text-2xl font-bold text-black sm:text-3xl">
          {sponsors.title}
        </h3>
        <p className="mt-4 text-lg leading-relaxed text-black/80">
          {sponsors.text}
        </p>
      </div>

      {images.length > 0 && (
        <div className="sponsors-arc mt-12" aria-hidden="false">
          <div className="sponsors-arc__pivot">
            {Array.from({ length: ARC_SLOT_COUNT }, (_, slot) => {
              const file = images[slot % images.length];
              return (
                <div
                  key={`${file}-${slot}`}
                  className="sponsors-arc__item"
                  style={
                    {
                      "--arc-angle": `${slot * ARC_STEP_DEG}deg`,
                    } as React.CSSProperties
                  }
                >
                  <MediaPlaceholderImage
                    src={file}
                    alt=""
                    tone="cream"
                    loading="eager"
                    className="max-h-full max-w-full object-contain"
                    wrapperClassName="flex h-full w-full items-center justify-center"
                  />
                </div>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
}
