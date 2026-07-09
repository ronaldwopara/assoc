import type { Metadata, Viewport } from "next";
import { SkipLink } from "@/components/skip-link";
import { Footer } from "@/components/footer";
import { NAV_TEXTURE_URL } from "@/lib/nav-texture";
import "./globals.css";

export const metadata: Metadata = {
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
  },
};

export const viewport: Viewport = {
  themeColor: "#f7f7f7",
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      translate="no"
      className="notranslate"
      data-scroll-behavior="smooth"
      suppressHydrationWarning
    >
      <head>
        <link rel="preload" href={NAV_TEXTURE_URL} as="image" type="image/webp" fetchPriority="high" />
      </head>
      <body className="min-h-screen antialiased" suppressHydrationWarning>
        <SkipLink />
        {children}
        <Footer />
      </body>
    </html>
  );
}
