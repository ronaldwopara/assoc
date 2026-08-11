import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Dashboard",
  robots: { index: false, follow: false },
};

/** Dashboard lives as an in-page upgrade tool — keep this URL for old bookmarks. */
export default function DashboardPage() {
  redirect("/upgrade?tool=dashboard");
}
