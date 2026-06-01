import { Navbar } from "@/components/navbar";
import { HeroSection } from "@/components/hero-section";
import { FeaturedPrograms } from "@/components/featured-programs";
import { PageSections } from "@/components/page-sections";

export default function Home() {
  return (
    <>
      <Navbar />
      <main id="main-content" className="site-main">
        <HeroSection />
        <FeaturedPrograms />
        <PageSections />
      </main>
    </>
  );
}
