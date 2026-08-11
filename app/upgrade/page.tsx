import type { Metadata } from "next";
import { UpgradePageContent } from "@/components/upgrade-page-content";
import { getDocumentsCmsData } from "@/lib/documents-cms";
import { getGalleryCmsData } from "@/lib/gallery-cms";
import { getPopupCmsData } from "@/lib/popup-cms";

export const metadata: Metadata = {
  title: "Upgrade",
  robots: { index: false, follow: false },
};

export default async function UpgradePage() {
  const [initialGalleryData, initialDocumentsData, initialPopupData] =
    await Promise.all([
      getGalleryCmsData(),
      getDocumentsCmsData(),
      getPopupCmsData(),
    ]);

  return (
    <main id="main-content" className="site-main min-h-screen bg-(--cream-light)">
      <UpgradePageContent
        initialGalleryData={initialGalleryData}
        initialDocumentsData={initialDocumentsData}
        initialPopupData={initialPopupData}
      />
    </main>
  );
}
