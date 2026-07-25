"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Mail, Phone } from "lucide-react";
import { EVENTS_PAGE_PATH } from "@/lib/events-nav";
import { GALLERY_BOTTOM_HREF } from "@/lib/gallery-scroll";
import { joinActionHref } from "@/lib/join-actions";
import { handleSectionLinkClick } from "@/lib/section-link";

function FacebookIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
      <path d="M22 12.06C22 6.5 17.52 2 12 2S2 6.5 2 12.06c0 5.02 3.66 9.18 8.44 9.94v-7.03H7.9v-2.91h2.54V9.85c0-2.51 1.49-3.9 3.78-3.9 1.1 0 2.24.2 2.24.2v2.46h-1.26c-1.24 0-1.63.77-1.63 1.56v1.89h2.78l-.45 2.91h-2.33V22c4.78-.76 8.44-4.92 8.44-9.94Z" />
    </svg>
  );
}

function InstagramIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37Z" />
      <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
    </svg>
  );
}

const exploreLinks = [
  { label: "Home", href: "/#home" },
  { label: "About", href: "/#about" },
  { label: "Programs", href: "/#programs" },
  { label: "Gallery", href: GALLERY_BOTTOM_HREF },
  { label: "Updates", href: "/#updates" },
];

const companyLinks = [
  { label: "About Us", href: "/#about" },
  { label: "Contact", href: joinActionHref("contact") },
];

const getInvolvedLinks = [
  { label: "Events", href: EVENTS_PAGE_PATH },
  { label: "Volunteer", href: joinActionHref("volunteer") },
  { label: "Donate", href: joinActionHref("donate") },
  { label: "Membership", href: joinActionHref("membership") },
  { label: "Vendor", href: joinActionHref("vendor") },
];

const connectLinks = [
  { label: "info@asosc.ca", href: "mailto:info@asosc.ca", icon: Mail },
  { label: "(587) 566-3212", href: "tel:+15875663212", icon: Phone },
  { label: "Facebook", href: "https://www.facebook.com/people/Africans-Society-of-Strathcona-County/61550552301286/?mibextid=wwXIfr&rdid=JKQw6RpiLSmQFyry&share_url=https%3A%2F%2Fwww.facebook.com%2Fshare%2F156xwBzZdx%2F%3Fmibextid%3DwwXIfr%26ref%3D1", icon: FacebookIcon },
  { label: "Instagram", href: "https://www.instagram.com/africansocietystrathconacounty?igsh=MmdwOTJrYWE3N2Jv&utm_source=qr", icon: InstagramIcon },
];

const FOOTER_MASK_SVG =
  "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1000 260'>" +
  "<text x='0' y='205' font-family='Arial, Helvetica, sans-serif' font-weight='900' " +
  "font-size='220' textLength='1000' lengthAdjust='spacingAndGlyphs' fill='white'>ASOSC</text>" +
  "</svg>";

const FOOTER_MASK_URL = `url("data:image/svg+xml,${encodeURIComponent(FOOTER_MASK_SVG)}")`;

export function Footer() {
  const pathname = usePathname();
  const isHome = pathname === "/";

  return (
    <footer id="contact" className="footer">
      <div className="footer__inner">
        <div
          className="footer__mask"
          style={{
            WebkitMaskImage: FOOTER_MASK_URL,
            maskImage: FOOTER_MASK_URL,
          }}
          aria-hidden="true"
        />
        <h2 className="sr-only">ASOSC</h2>

        <div className="footer__body">
          <p className="footer__acknowledgment">
            <span>
              We respectfully acknowledge that the Africans Society of Strathcona
              County operates on Treaty 6 Territory, the traditional lands of many
              First Nations and the Métis. We honour Indigenous Peoples, their
              enduring stewardship of these lands, and our shared commitment to
              reconciliation.
            </span>
          </p>

          <div className="footer__columns">
            <div>
              <h3 className="footer__heading">Explore</h3>
              <ul className="footer__list">
                {exploreLinks.map((link) => (
                  <li key={link.label}>
                    <Link
                      href={link.href}
                      className="footer__link focus-ring-light"
                      onClick={(event) => handleSectionLinkClick(event, link.href, isHome)}
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h3 className="footer__heading">Get Involved</h3>
              <ul className="footer__list">
                {getInvolvedLinks.map((link) => (
                  <li key={link.label}>
                    <Link
                      href={link.href}
                      className="footer__link focus-ring-light"
                      onClick={(event) => handleSectionLinkClick(event, link.href, isHome)}
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h3 className="footer__heading">Company</h3>
              <ul className="footer__list">
                {companyLinks.map((link) => (
                  <li key={link.label}>
                    <Link
                      href={link.href}
                      className="footer__link focus-ring-light"
                      onClick={(event) => handleSectionLinkClick(event, link.href, isHome)}
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        <div className="footer__connect">
          {connectLinks.map(({ label, href, icon: Icon }) => (
            <a
              key={label}
              href={href}
              className="footer__connect-link focus-ring-light"
            >
              <span className="footer__connect-icon" aria-hidden="true">
                <Icon className="h-3.5 w-3.5" />
              </span>
              {label}
            </a>
          ))}
        </div>

        <div className="footer__bottom">
          <span className="footer__copyright">
            © {new Date().getFullYear()} Africans Society of Strathcona County. All rights
            reserved.
          </span>
        </div>
      </div>
    </footer>
  );
}
