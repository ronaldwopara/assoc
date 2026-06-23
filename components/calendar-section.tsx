"use client";

import { useState } from "react";
import { Calendar as CalendarIcon, MapPin } from "lucide-react";
import { JoinCommunityModal } from "@/components/join-community-modal";

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
    title: "Black History Month",
    badge: "FEB",
    location: "Strathcona County, AB",
    when: "Annual — February",
    videoSrc: "/black-history-month.mp4",
    href: "#bhm",
  },
  {
    title: "End-of-Year/Volunteer Appreciation Party",
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
    title: "Youth Creative Lab",
    badge: "ALL YEAR",
    location: "Strathcona County, AB",
    when: "Ongoing program",
    videoSrc: "/Youth-Creative-Media-Lab.mp4",
    href: "#youth-lab",
  },
];

export function CalendarSection() {
  const [isVolunteerModalOpen, setIsVolunteerModalOpen] = useState(false);

  return (
    <>
      <section
        id="calendar"
        className="section-shell bg-black relative overflow-hidden"
        aria-labelledby="calendar-heading"
      >
        <div className="relative z-10">
          <div className="mx-auto max-w-3xl text-center">
            <h2 id="calendar-heading" className="text-[clamp(2.5rem,6vw,4.5rem)] font-bold tracking-wide text-(--orange-light)">
              Calendar
            </h2>
            <span className="mt-4 inline-block rounded-full bg-(--hero-cta) px-4 py-1 text-sm font-bold uppercase tracking-wide text-black">
              Upcoming Events
            </span>
          </div>

          <div className="mx-auto mt-12 max-w-4xl">
            {upcomingEvents.map((event) => (
              <div
                key={event.title}
                className="flex flex-col items-start gap-4 border-b border-(--cream-light)/15 py-6 last:border-b-0 sm:flex-row sm:items-center sm:gap-6"
              >
                <div className="w-20 shrink-0 text-center sm:w-16">
                  <span className="inline-block rounded-full bg-(--orange-light) px-3 py-1 text-xs font-bold uppercase tracking-wide text-black">
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
                      <MapPin className="h-4 w-4 text-(--orange-light)" />
                      {event.location}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <CalendarIcon className="h-4 w-4 text-(--orange-light)" />
                      {event.when}
                    </span>
                  </div>
                </div>

                <div className="flex w-full shrink-0 flex-row gap-2 sm:w-auto">
                  <button
                    type="button"
                    disabled
                    className="hero-cta-btn inline-flex w-full cursor-default items-center justify-center px-8 py-3 text-sm font-semibold tracking-wide text-black transition duration-200 ease-out"
                  >
                    Register
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsVolunteerModalOpen(true)}
                    className="hero-cta-btn focus-ring-light inline-flex w-full cursor-pointer items-center justify-center px-8 py-3 text-sm font-semibold tracking-wide text-black transition duration-200 ease-out"
                  >
                    Volunteer
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <JoinCommunityModal
        isOpen={isVolunteerModalOpen}
        onClose={() => setIsVolunteerModalOpen(false)}
        initialAction="Volunteer"
      />
    </>
  );
}
