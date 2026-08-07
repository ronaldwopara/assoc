import type { Metadata } from "next";
import { DashboardPageContent } from "@/components/dashboard/dashboard-page-content";

export const metadata: Metadata = {
  title: "Dashboard",
  robots: { index: false, follow: false },
};

export default function DashboardPage() {
  return (
    <main id="main-content" className="site-main dash-page">
      <DashboardPageContent />
    </main>
  );
}
