import type { Metadata } from "next";
import { SkipLink } from "@/components/skip-link";
import { Footer } from "@/components/footer";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "ASOSC - Africans Society of Strathcona County",
    template: "%s | ASOSC",
  },
  description:
    "Empowering Africans to enrich the social, economic, and cultural fabric of Strathcona County and beyond.",
  openGraph: {
    type: "website",
  },
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
      <body className="min-h-screen antialiased" suppressHydrationWarning>
        <SkipLink />
        {children}
        <Footer />
      </body>
    </html>
  );
}
