import fs from "node:fs";
import path from "node:path";
import Link from "next/link";
import { FileText, Download, Calendar as CalendarIcon, MapPin } from "lucide-react";
import { ArcGalleryHero } from "@/components/arc-gallery-hero";
import { StackedCardBody, StackedCards } from "@/components/stacked-cards";
import { WavyMarquee } from "@/components/wavy-marquee";

const IMAGE_EXTENSIONS = /\.(jpe?g|png|webp|avif|gif)$/i;

function getUpdateImages(): string[] {
  const updatesDir = path.join(process.cwd(), "public", "updates");
  try {
    return fs
      .readdirSync(updatesDir)
      .filter((file) => IMAGE_EXTENSIONS.test(file))
      .sort();
  } catch {
    return [];
  }
}

function getGalleryImages(): string[] {
  const galleryDir = path.join(process.cwd(), "public", "gallery-prev");
  try {
    return fs
      .readdirSync(galleryDir)
      .filter((file) => IMAGE_EXTENSIONS.test(file))
      .sort()
      .map((file) => `/gallery-prev/${encodeURIComponent(file)}`);
  } catch {
    return [];
  }
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

interface UpcomingEvent {
  title: string;
  badge: string;
  location: string;
  when: string;
  videoSrc: string;
  href: string;
}

const upcomingEvents: UpcomingEvent[] = [
  {
    title: "African Festival",
    badge: "AUG",
    location: "Strathcona County, AB",
    when: "Annual — August",
    videoSrc: "/African-festival.mp4",
    href: "#festival",
  },
  {
    title: "Black History Month Gala",
    badge: "FEB",
    location: "Strathcona County, AB",
    when: "Annual — February",
    videoSrc: "/black-history-month.mp4",
    href: "#bhm",
  },
  {
    title: "Annual End-of-Year Celebration",
    badge: "DEC",
    location: "Strathcona County, AB",
    when: "Annual — December",
    videoSrc: "/Annual-End-of-Year-Celebration.mp4",
    href: "#celebration",
  },
  {
    title: "Family Wellness Seminars",
    badge: "ALL YEAR",
    location: "Strathcona County, AB",
    when: "Seasonal sessions",
    videoSrc: "/Family-Wellness-Seminars.mp4",
    href: "#wellness",
  },
  {
    title: "Youth Creative Media Lab",
    badge: "ALL YEAR",
    location: "Strathcona County, AB",
    when: "Ongoing program",
    videoSrc: "/Youth-Creative-Media-Lab.mp4",
    href: "#youth-lab",
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
      <WavyMarquee
        text="ABOUT US"
        headingId="about-heading"
        speed={0.5}
        waveIntensity={60}
      />

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
          videoLabel="Youth Creative Media Lab program"
        >
          <h3 className="mb-4">What We Do</h3>
          <p className="mb-4">We design and deliver programs that:</p>
          <ul className="stacked-card__list">
            <CardBullet>Celebrate and showcase African culture</CardBullet>
            <CardBullet>Share African and immigrant stories.</CardBullet>
            <CardBullet>Empower African youth and families.</CardBullet>
          </ul>
        </StackedCardBody>
      </StackedCards>
    </>
  );
}

export function AboutSection() {
  return (
    <section
      id="about"
      className="section-shell bg-[var(--cream-light)]"
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

export function PageSections() {
  const galleryImages = getGalleryImages();

  return (
    <>
      <ArcGalleryHero images={galleryImages} />

      <section
        id="calendar"
        className="section-shell bg-(--terracotta) relative overflow-hidden"
        aria-labelledby="calendar-heading"
      >
        <div className="programs-bg-texture" aria-hidden="true" />
        <div className="programs-bg-grain" aria-hidden="true" />

        <div className="relative z-10">
          <div className="supplemental mx-auto max-w-3xl text-center">
            <h2 id="calendar-heading" className="section-heading">
              Calendar
            </h2>
            <div className="section-lead mx-auto">
              Upcoming Events
            </div>
          </div>

          <div className="mx-auto mt-12 max-w-4xl">
            {upcomingEvents.map((event) => (
              <div
                key={event.title}
                className="flex flex-col items-start gap-4 border-b border-(--cream-light)/15 py-6 last:border-b-0 sm:flex-row sm:items-center sm:gap-6"
              >
                <div className="w-20 shrink-0 text-center sm:w-16">
                  <span className="inline-block rounded-full bg-(--gold) px-3 py-1 text-xs font-bold uppercase tracking-wide text-(--brown-dark)">
                    {event.badge}
                  </span>
                </div>

                <video
                  className="h-24 w-full shrink-0 rounded-xl object-cover sm:h-24 sm:w-36"
                  src={event.videoSrc}
                  muted
                  loop
                  autoPlay
                  playsInline
                  preload="metadata"
                  aria-hidden="true"
                />

                <div className="flex-1 text-left">
                  <h3 className="text-xl font-bold text-(--cream-light) sm:text-2xl">
                    {event.title}
                  </h3>
                  <div className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-1 text-sm text-(--cream)/80">
                    <span className="flex items-center gap-1.5 font-semibold">
                      <MapPin className="h-4 w-4 text-(--gold)" />
                      {event.location}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <CalendarIcon className="h-4 w-4 text-(--gold)" />
                      {event.when}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
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
        <h2 id="documents-heading" className="section-heading">
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
            <h3 className="mb-4 text-lg font-bold uppercase tracking-wide text-(--brown-dark)">
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
                    <FileText className="h-5 w-5 shrink-0 text-(--brown-dark)/60" />
                    <span className="font-medium text-(--brown-dark)">
                      {item.label}
                    </span>
                  </span>
                  <Download className="h-5 w-5 shrink-0 text-(--brown-dark)/60 transition-colors duration-200 group-hover:text-(--brown-dark)" />
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
  const galleryImages = images.length > 0 ? [...images, ...images] : [];

  return (
    <section
      id="updates"
      className="section-shell bg-(--cream-light)"
      aria-labelledby="updates-heading"
    >
      <WavyMarquee
        text="UPDATES"
        headingId="updates-heading"
        speed={0.5}
        waveIntensity={60}
      />

      <div className="mx-auto max-w-3xl rounded-3xl border border-(--brown-dark)/10 bg-(--cream)/60 px-6 py-8 text-center sm:px-10 sm:py-10">
        <span className="inline-block rounded-full bg-(--hero-cta)/20 px-4 py-1 text-sm font-bold uppercase tracking-wide text-(--brown-dark)">
          February 2026
        </span>
        <h3 className="mt-4 text-2xl font-bold text-(--brown-dark) sm:text-3xl">
          Black History Month
        </h3>
        <p className="mt-4 text-lg leading-relaxed text-(--brown-dark)/80">
          Strathcona County officially declares February 2026 as Black
          History Month, recognizing and celebrating the contributions,
          culture, and resilience of Black communities while supporting
          inclusive community initiatives.
        </p>
      </div>

      {galleryImages.length > 0 && (
        <div className="updates-marquee mt-12">
          <div className="updates-marquee__track">
            {galleryImages.map((file, index) => (
              <div
                key={`${file}-${index}`}
                className="updates-marquee__item h-48 w-48 shrink-0 overflow-hidden rounded-xl shadow-lg transition-transform duration-300 hover:scale-105 md:h-64 md:w-64 lg:h-72 lg:w-72"
              >
                <img
                  src={`/updates/${encodeURIComponent(file)}`}
                  alt=""
                  className="h-full w-full object-cover"
                  loading="lazy"
                />
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
