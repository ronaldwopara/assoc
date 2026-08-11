import type { Metadata, Viewport } from "next";
import { preload } from "react-dom";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { PreventTextCaret } from "@/components/prevent-text-caret";
import { OrientationLock } from "@/components/orientation-lock";
import { SafeAreaFrame } from "@/components/safe-area-frame";
import { AnnouncementBar } from "@/components/announcement-bar";
import { SkipLink } from "@/components/skip-link";
import { Footer } from "@/components/footer";
import { GalleryCmsProvider } from "@/components/gallery-cms-provider";
import { StaffToolsFabHost } from "@/components/staff-tools-fab-host";
import { getGalleryCmsData } from "@/lib/gallery-cms";
import "./globals.css";

// Social share/preview image — the same logo shown in the header, forced to
// JPEG (f_jpg) for scraper compatibility, q_auto compressed. The v… version
// pins a stable URL for platform caches.
const OG_IMAGE =
  "https://res.cloudinary.com/daldas2e7/image/upload/f_jpg,q_auto/v1782952089/asosc/about-us-logo.webp";
const OG_IMAGE_WIDTH = 500;
const OG_IMAGE_HEIGHT = 500;

export const metadata: Metadata = {
  metadataBase: new URL("https://asosc.ca"),
  title: {
    default: "ASOSC - Africans Society of Strathcona County",
    template: "%s | ASOSC",
  },
  description:
    "Empowering Africans to enrich the social, economic, and cultural fabric of Strathcona County and beyond.",
  icons: {
    icon: "https://res.cloudinary.com/daldas2e7/image/upload/v1782010314/asosc/logo.webp",
    apple: "https://res.cloudinary.com/daldas2e7/image/upload/v1782010314/asosc/logo.webp",
  },
  openGraph: {
    type: "website",
    siteName: "ASOSC - Africans Society of Strathcona County",
    images: [
      {
        url: OG_IMAGE,
        width: OG_IMAGE_WIDTH,
        height: OG_IMAGE_HEIGHT,
        alt: "ASOSC logo",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    images: [OG_IMAGE],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#f7f7f7",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Warm the shared nav texture at low priority so the Join modal header and
  // mobile-nav panel don't wait on a cold 129KB fetch when first opened.
  preload("/nav.webp", { as: "image", fetchPriority: "low" });
  const galleryCms = await getGalleryCmsData();
  const announcementActive =
    galleryCms.announcement.enabled && galleryCms.announcement.text.trim().length > 0;

  return (
    <html
      lang="en"
      translate="no"
      className="notranslate"
      data-scroll-behavior="smooth"
      suppressHydrationWarning
    >
      <body
        className="min-h-screen antialiased"
        data-announcement={announcementActive ? "true" : undefined}
        suppressHydrationWarning
      >
        {/* Mount strips first so the notch/home-indicator paint before splash/modals */}
        <SafeAreaFrame />
        <AnnouncementBar announcement={galleryCms.announcement} />
        <PreventTextCaret />
        <SkipLink />
        <GalleryCmsProvider data={galleryCms}>{children}</GalleryCmsProvider>
        <Footer />
        <StaffToolsFabHost />
        <OrientationLock />
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
