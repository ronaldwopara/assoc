"use client";

import Link from "next/link";
import { EVENTS_PAGE_PATH } from "@/lib/events-nav";
import { upcomingEvents, type UpcomingEvent } from "@/lib/events-data";

const MONTH_BY_BADGE: Record<string, number> = { FEB: 2, AUG: 8, DEC: 12 };

/** Short display titles so long official names fit the fixed ticket height. */
const TICKET_TITLES: Record<string, string> = {
  "End-of-Year/Volunteer Appreciation Party": "End-of-Year Party",
  "Settlement & Well-Being Initiatives": "Settlement & Well-Being",
};

/** Stable fake serial so each ticket always prints the same number. */
function serialFor(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return String(hash % 100_000_000).padStart(8, "0");
}

function ticketYear(event: UpcomingEvent, now: Date): number {
  const month = MONTH_BY_BADGE[event.badge];
  if (!month) return now.getFullYear();
  return month >= now.getMonth() + 1 ? now.getFullYear() : now.getFullYear() + 1;
}

function EventTicket({ event, year }: { event: UpcomingEvent; year: number }) {
  const displayTitle = TICKET_TITLES[event.title] ?? event.title;

  return (
    <span className="eticket">
      <span className="eticket__sheen" aria-hidden="true" />

      <span className="eticket__no eticket__no--left" aria-hidden="true">
        NO.&nbsp;{serialFor(event.badge + event.when + event.title)}
      </span>

      <span className="eticket__body">
        <span className="eticket__main">
          <span className="eticket__title">
            {displayTitle} {year}
          </span>
          <span className="eticket__details">
            <span className="eticket__date-pill">
              {event.badge} {year}
            </span>
            <span className="eticket__row">
              <span className="eticket__row-label">When:</span> {event.when}
            </span>
            <span className="eticket__row">
              <span className="eticket__row-label">Where:</span> {event.location}
            </span>
          </span>
        </span>
        <span className="eticket__perf" aria-hidden="true" />
        <span className="eticket__barcode" aria-hidden="true" />
      </span>

      <span className="eticket__no eticket__no--right" aria-hidden="true">
        NO.&nbsp;{serialFor(event.title)}
      </span>
    </span>
  );
}

export function EventTicketMarquee() {
  const now = new Date();
  // Track is duplicated once so the -50% translate loops seamlessly.
  const loop = [...upcomingEvents, ...upcomingEvents];

  return (
    <div className="eticket-marquee" aria-label="Upcoming ASOSC events">
      <div className="eticket-marquee__track">
        {loop.map((event, index) => {
          const isDuplicate = index >= upcomingEvents.length;
          return (
            <Link
              key={`${event.title}-${index}`}
              href={EVENTS_PAGE_PATH}
              className="eticket-marquee__item focus-ring-light"
              aria-label={`See upcoming events — ${event.title}`}
              aria-hidden={isDuplicate || undefined}
              tabIndex={isDuplicate ? -1 : undefined}
            >
              <EventTicket event={event} year={ticketYear(event, now)} />
            </Link>
          );
        })}
      </div>
    </div>
  );
}
