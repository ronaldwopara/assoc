import type { Metadata } from "next";
import { Navbar } from "@/components/navbar";
import { StoriesLibrary } from "@/components/stories/stories-library";

export const metadata: Metadata = {
  title: "Walking in Their Shoes",
  description:
    "An Our Story, Our Voice documentary sharing the lived experiences of African and Black immigrants in Canada.",
};

export default async function StoriesPage({ searchParams }: { searchParams: Promise<{ library?: string }> }) {
  const { library } = await searchParams;
  const notice = library === "signed-in" || library === "expired" ? library : undefined;
  return (
    <>
      <Navbar />
      <main id="main-content" className="site-main">
        {/* section-shell clears the fixed header, the same way /join does. */}
        <div className="section-shell">
          <StoriesLibrary notice={notice} />
        </div>
      </main>
    </>
  );
}
