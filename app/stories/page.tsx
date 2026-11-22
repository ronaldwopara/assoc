import type { Metadata } from "next";
import { Navbar } from "@/components/navbar";
import { StoriesLibrary } from "@/components/stories/stories-library";
import { getPublishedDocumentaries } from "@/lib/documentaries";

export const metadata: Metadata = {
  title: "Our Story, Our Voice Documentaries",
  description:
    "Our Story, Our Voice documentaries sharing the lived experiences of African and Black immigrants in Canada.",
};

export default async function StoriesPage({ searchParams }: { searchParams: Promise<{ library?: string }> }) {
  const { library } = await searchParams;
  const notice = library === "signed-in" || library === "expired" ? library : undefined;
  const films = await getPublishedDocumentaries();
  return (
    <>
      <Navbar />
      <main id="main-content" className="site-main">
        {/* section-shell clears the fixed header, the same way /join does. */}
        <div className="section-shell">
          <StoriesLibrary films={films} notice={notice} />
        </div>
      </main>
    </>
  );
}
