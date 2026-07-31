"use client";

import Link from "next/link";
import { Clock, MapPin } from "lucide-react";
import { MediaPlaceholderVideo } from "@/components/media-placeholder";
import { PageBackLink } from "@/components/page-back-link";
import { SectionLogoHeading } from "@/components/section-logo-heading";
import { ContentBrow } from "@/components/content-brow";
import { eventActionLinks, upcomingEvents } from "@/lib/events-data";
import { joinActionHref } from "@/lib/join-actions";

function EventsList() {
  return (
      <div className="mx-auto mt-12 max-w-4xl">
        {upcomingEvents.map((event) => {
          const actionLink = eventActionLinks[event.title];

          return (
            <div
              key={event.title}
              className="flex flex-col items-start gap-4 border-b border-(--cream-light)/15 py-6 last:border-b-0 sm:flex-row sm:items-center sm:gap-6"
            >
              <div className="w-20 shrink-0 text-center sm:w-16">
                <span className="inline-block rounded-full bg-(--orange-light) px-3 py-1 text-xs font-bold uppercase tracking-wide text-black">
                  {event.badge}
                </span>
              </div>

              <MediaPlaceholderVideo
                className="h-24 w-full shrink-0 rounded-xl object-cover sm:h-24 sm:w-36"
                wrapperClassName="h-24 w-full shrink-0 rounded-xl sm:h-24 sm:w-36"
                src={event.videoSrc}
                tone="black"
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
                    <Clock className="h-4 w-4 text-(--orange-light)" />
                    {event.when}
                  </span>
                </div>
              </div>

              <div className="flex w-full shrink-0 flex-row gap-2 sm:w-auto">
                {actionLink ? (
                  <a
                    href={actionLink.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hero-cta-btn focus-ring-light inline-flex w-full cursor-pointer items-center justify-center px-8 py-3 text-sm font-semibold tracking-wide text-black transition duration-200 ease-out"
                  >
                    {actionLink.label}
                  </a>
                ) : (
                  <>
                    <button
                      type="button"
                      disabled
                      className="hero-cta-btn inline-flex w-full cursor-default items-center justify-center px-8 py-3 text-sm font-semibold tracking-wide text-black transition duration-200 ease-out"
                    >
                      Register
                    </button>
                    <Link
                      href={joinActionHref("volunteer")}
                      className="hero-cta-btn focus-ring-light inline-flex w-full cursor-pointer items-center justify-center px-8 py-3 text-sm font-semibold tracking-wide text-black transition duration-200 ease-out"
                    >
                      Volunteer
                    </Link>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>
  );
}

export function EventsPageContent() {
  return (
    <section
      className="section-shell bg-black relative overflow-hidden"
      aria-labelledby="events-page-heading"
    >
      <div className="relative z-10">
        <div className="mx-auto mb-2 max-w-3xl px-4 sm:mb-3 sm:px-6">
          <PageBackLink theme="dark" />
        </div>
        <div className="mx-auto max-w-3xl text-center">
          <SectionLogoHeading
            id="events-page-heading"
            as="h1"
            className="mb-2 text-(--orange-light)"
          >
            Events
          </SectionLogoHeading>
          <ContentBrow theme="dark">Show Up & Celebrate</ContentBrow>
        </div>
        <EventsList />
      </div>
    </section>
  );
}
