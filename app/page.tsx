import { Navbar } from "@/components/navbar";
import { HeroSection } from "@/components/hero-section";
import { FeaturedPrograms } from "@/components/featured-programs";
import { CommunityActionSection } from "@/components/volunteer-section";
import { AboutSection, GallerySection, SponsorsSection, UpdatesSection } from "@/components/page-sections";
import { JoinDeepLink } from "@/components/join-deep-link";
import { FlyerPopup } from "@/components/flyer-popup";
import { getPopupCmsData } from "@/lib/popup-cms";

export default async function Home() {
  const popupData = await getPopupCmsData();

  return (
    <>
      <JoinDeepLink />
      <Navbar />
      <main id="main-content" className="site-main">
        <HeroSection />
        <AboutSection />
        <FeaturedPrograms />
        <CommunityActionSection actionId="membership" />
        <GallerySection />
        <CommunityActionSection actionId="donate" />
        <CommunityActionSection actionId="events" />
        <CommunityActionSection actionId="volunteer" />
        <CommunityActionSection actionId="vendor" />
        <UpdatesSection />
        <CommunityActionSection actionId="contact" />
        <SponsorsSection />
      </main>
      <FlyerPopup popup={popupData} />
    </>
  );
}
