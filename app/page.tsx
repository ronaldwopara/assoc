import { Navbar } from "@/components/navbar";
import { HeroSection } from "@/components/hero-section";
import { FeaturedPrograms } from "@/components/featured-programs";
import { CommunityActionSection } from "@/components/volunteer-section";
import { AboutSection, CalendarSection, GallerySection, UpdatesSection } from "@/components/page-sections";
import { LoadingScreen } from "@/components/loading-screen";

export default function Home() {
  return (
    <>
      <LoadingScreen />
      <Navbar />
      <main id="main-content" className="site-main">
        <HeroSection />
        <AboutSection />
        <FeaturedPrograms />
        <CommunityActionSection actionId="volunteer" />
        <GallerySection />
        <CommunityActionSection actionId="donate" />
        <CalendarSection />
        <CommunityActionSection actionId="membership" />
        <UpdatesSection />
        <CommunityActionSection actionId="contact" />
      </main>
    </>
  );
}
