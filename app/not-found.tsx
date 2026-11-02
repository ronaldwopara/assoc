import type { Metadata } from "next";
import Link from "next/link";
import { Navbar } from "@/components/navbar";
import { joinActionHref } from "@/lib/join-actions";

export const metadata: Metadata = {
  title: "Page not found",
  robots: { index: false, follow: false },
};

const LINKS = [
  { label: "About ASOSC", href: "/about" },
  { label: "Events", href: "/events" },
  { label: "Programs", href: "/programs" },
  { label: "Gallery", href: "/gallery" },
  { label: "Become a member", href: joinActionHref("membership") },
];

/** Site-wide 404, inside the root layout (announcement bar, nav, footer). */
export default function NotFound() {
  return (
    <>
      <Navbar />
      <main id="main-content" className="site-main">
        <section className="section-shell not-found" aria-labelledby="not-found-title">
          <p className="not-found__code" aria-hidden="true">
            404
          </p>
          <h1 id="not-found-title" className="not-found__title">
            We couldn&rsquo;t find that page
          </h1>
          <p className="not-found__lede">
            The link may be old, or the page may have moved. Everything ASOSC does is still a click away.
          </p>
          <Link
            href="/"
            className="hero-cta-btn hero-cta-btn--primary focus-ring-light inline-flex min-h-12 items-center justify-center px-10 py-3 text-sm font-semibold tracking-wide"
          >
            Go to the homepage
          </Link>
          <nav className="not-found__links" aria-label="Popular pages">
            {LINKS.map((l) => (
              <Link key={l.href} href={l.href} className="not-found__link focus-ring-light">
                {l.label}
              </Link>
            ))}
          </nav>
          <p className="not-found__help">
            Followed a broken link from our site?{" "}
            <Link href={joinActionHref("contact")} className="not-found__inline-link focus-ring-light">
              Let us know
            </Link>{" "}
            and we&rsquo;ll fix it.
          </p>
        </section>
      </main>
    </>
  );
}
