import type { Metadata } from "next";
import { UpgradePageContent } from "@/components/upgrade-page-content";
import { getGalleryCmsData } from "@/lib/gallery-cms";

export const metadata: Metadata = {
  title: "Upgrade",
  robots: { index: false, follow: false },
};

export default async function UpgradePage() {
  const initialData = await getGalleryCmsData();

  return (
    <main id="main-content" className="site-main min-h-screen bg-(--cream-light)">
      <UpgradePageContent initialData={initialData} />
    </main>
  );
}
