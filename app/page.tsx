import { Navbar } from "@/components/navbar";
import { HeroSection } from "@/components/hero-section";
import { FeaturedPrograms } from "@/components/featured-programs";
import { AboutSection, PageSections, UpdatesSection } from "@/components/page-sections";
import { LoadingScreen } from "@/components/loading-screen";

export default function Home() {
  return (
    <>
      <LoadingScreen />
      <Navbar />
      <main id="main-content" className="site-main">
        <HeroSection />
        <AboutSection />
        <UpdatesSection />
        <FeaturedPrograms />
        <PageSections />
      </main>
    </>
  );
}
