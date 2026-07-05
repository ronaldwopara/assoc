import type { Metadata } from "next";
import { Navbar } from "@/components/navbar";
import { EventsPageContent } from "@/components/events-section";

export const metadata: Metadata = {
  title: "Events",
  description:
    "Upcoming ASOSC festivals, programs, and community gatherings across Strathcona County.",
};

export default function EventsPage() {
  return (
    <>
      <Navbar />
      <main id="main-content" className="site-main">
        <EventsPageContent />
      </main>
    </>
  );
}
