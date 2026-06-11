"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { motion, type Variants, AnimatePresence } from "framer-motion";
import { type Ref, useEffect, useState } from "react";
import asoscLogo from "../Asosc-Logo.png";
type NavLink = { label: string; href: string };

export type GalleryYear = { year: string; href: string };
export type GalleryProgram = { program: string; years: GalleryYear[] };

type ProgramItem = {
  title: string;
  description: string;
  href: string;
};

type MobileNavMenuProps = {
  isOpen: boolean;
  onClose: () => void;
  programsOpen: boolean;
  setProgramsOpen: (open: boolean) => void;
  galleryOpen: boolean;
  setGalleryOpen: (open: boolean) => void;
  leftLinks: NavLink[];
  rightLinks: NavLink[];
  programs: ProgramItem[];
  gallery: GalleryProgram[];
  toggleX: number;
  toggleY: number;
  onJoinCommunityClick: () => void;
};

const navListVariants: Variants = {
  open: {
    transition: { staggerChildren: 0.07, delayChildren: 0.2 },
  },
  closed: {
    transition: { staggerChildren: 0.05, staggerDirection: -1 },
  },
};

const navItemVariants: Variants = {
  open: {
    y: 0,
    opacity: 1,
    transition: { y: { stiffness: 1000, velocity: -100 } },
  },
  closed: {
    y: 40,
    opacity: 0,
    transition: { y: { stiffness: 1000 } },
  },
};

function Path({
  d,
  variants,
  transition,
}: {
  d?: string;
  variants: Variants;
  transition?: { duration: number };
}) {
  return (
    <motion.path
      fill="transparent"
      strokeWidth="2.5"
      stroke="currentColor"
      strokeLinecap="round"
      d={d}
      variants={variants}
      transition={transition}
    />
  );
}

export function MobileMenuToggle({
  isOpen,
  onToggle,
  ref,
}: {
  isOpen: boolean;
  onToggle: () => void;
  ref?: Ref<HTMLButtonElement>;
}) {
  return (
    <button
      ref={ref}
      type="button"
      className="focus-ring relative flex h-11 w-11 cursor-pointer items-center justify-center text-white lg:hidden"
      style={{ zIndex: 52 }}
      onClick={onToggle}
      aria-label={isOpen ? "Close menu" : "Open menu"}
      aria-expanded={isOpen}
    >
      <motion.svg
        width="23"
        height="23"
        viewBox="0 0 23 23"
        aria-hidden
        animate={isOpen ? "open" : "closed"}
        initial={false}
      >
        <Path
          variants={{
            closed: { d: "M 2 2.5 L 20 2.5" },
            open: { d: "M 3 16.5 L 17 2.5" },
          }}
        />
        <Path
          d="M 2 9.423 L 20 9.423"
          variants={{
            closed: { opacity: 1 },
            open: { opacity: 0 },
          }}
          transition={{ duration: 0.1 }}
        />
        <Path
          variants={{
            closed: { d: "M 2 16.346 L 20 16.346" },
            open: { d: "M 3 2.5 L 17 16.346" },
          }}
        />
      </motion.svg>
    </button>
  );
}

export function MobileNavMenu({
  isOpen,
  onClose,
  programsOpen,
  setProgramsOpen,
  galleryOpen,
  setGalleryOpen,
  leftLinks,
  rightLinks,
  programs,
  gallery,
  toggleX,
  toggleY,
  onJoinCommunityClick,
}: MobileNavMenuProps) {
  const pathname = usePathname();
  const router = useRouter();
  const isHome = pathname === "/";
  const [viewportH, setViewportH] = useState(800);

  useEffect(() => {
    const update = () => setViewportH(window.innerHeight);
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  const panelVariants: Variants = {
    open: {
      clipPath: `circle(${viewportH * 3.5 + 200}px at ${toggleX}px ${toggleY}px)`,
      transition: { type: "spring", stiffness: 20, restDelta: 2 },
    },
    closed: {
      clipPath: `circle(0px at ${toggleX}px ${toggleY}px)`,
      transition: { delay: 0.2, type: "spring", stiffness: 400, damping: 40 },
    },
  };

  return (
    <motion.nav
      className="fixed inset-0 lg:hidden"
      style={{ zIndex: 51, pointerEvents: isOpen ? "auto" : "none" }}
      initial={false}
      animate={isOpen ? "open" : "closed"}
      aria-hidden={!isOpen}
    >
      {/* Backdrop tap-to-close */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            className="absolute inset-0"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
        )}
      </AnimatePresence>

      {/* Reveal panel */}
      <motion.div
        className="mobile-nav-panel absolute inset-0"
        variants={panelVariants}
      >
        {/* Close button */}
        <button
          type="button"
          onClick={onClose}
          aria-label="Close menu"
          className="absolute right-4 top-6 flex h-11 w-11 items-center justify-center text-(--gold) focus-ring-light"
        >
          <svg width="26" height="26" viewBox="0 0 26 26" fill="none" aria-hidden>
            <path d="M4 4l18 18M22 4L4 22" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
          </svg>
        </button>

        <div className="flex h-full flex-col justify-between overflow-y-auto px-8 pb-10 pt-20">
          <motion.ul
            className="m-0 list-none p-0"
            variants={navListVariants}
            onTouchStart={() => {}}
          >
            {leftLinks.map((link) => (
              <motion.li key={link.label} variants={navItemVariants}>
                <Link href={link.href} className="mobile-nav-link focus-ring-light block" onClick={onClose}>
                  {link.label}
                </Link>
              </motion.li>
            ))}

            {/* Programs accordion */}
            <motion.li variants={navItemVariants}>
              <button
                type="button"
                className="mobile-nav-programs focus-ring-light"
                onClick={() => { setProgramsOpen(!programsOpen); setGalleryOpen(false); }}
                aria-expanded={programsOpen}
              >
                Programs
                <svg
                  className={`mobile-nav-programs__chevron${programsOpen ? " mobile-nav-programs__chevron--open" : ""}`}
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth="3"
                  stroke="currentColor"
                  aria-hidden
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </button>

              <AnimatePresence>
                {programsOpen && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.25 }}
                    className="overflow-hidden"
                  >
                    <div className="programs-panel mx-0 mt-3" style={{ width: '100%' }}>
                      <ul className="m-0 grid list-none gap-2 p-2.5">
                        {programs.map((program) => (
                          <li key={program.title}>
                            <button
                              type="button"
                              className="program-card focus-ring-light w-full text-left"
                              onClick={() => {
                                if (isHome) {
                                  window.dispatchEvent(new CustomEvent("openProgram", { detail: { href: program.href } }));
                                  document.getElementById("programs")?.scrollIntoView({ behavior: "smooth" });
                                } else {
                                  router.push(program.href);
                                }
                                onClose();
                              }}
                            >
                              <div className="min-w-0 flex-1">
                                <div className="program-card__title">{program.title}</div>
                                <p className="program-card__desc">{program.description}</p>
                              </div>
                            </button>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.li>

            {/* Gallery accordion */}
            <motion.li variants={navItemVariants}>
              <button
                type="button"
                className="mobile-nav-programs focus-ring-light"
                onClick={() => { setGalleryOpen(!galleryOpen); setProgramsOpen(false); }}
                aria-expanded={galleryOpen}
              >
                Gallery
                <svg
                  className={`mobile-nav-programs__chevron${galleryOpen ? " mobile-nav-programs__chevron--open" : ""}`}
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth="3"
                  stroke="currentColor"
                  aria-hidden
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </button>

              <AnimatePresence>
                {galleryOpen && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.25 }}
                    className="overflow-hidden"
                  >
                    <div className="gallery-panel mx-0 mt-3" style={{ width: '100%' }}>
                      <div className="grid gap-3 p-2.5 sm:grid-cols-2">
                        {gallery.map((item) => (
                          <div key={item.program} className="gallery-group">
                            <div className="gallery-group__header">{item.program}</div>
                            <ul className="flex flex-wrap gap-1.5 px-0.5 py-1.5">
                              {item.years.map((y) => (
                                <li key={y.year}>
                                  <Link
                                    href={y.href}
                                    className="gallery-year-pill focus-ring-light"
                                    onClick={onClose}
                                  >
                                    {y.year}
                                  </Link>
                                </li>
                              ))}
                            </ul>
                          </div>
                        ))}
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.li>

            {rightLinks
              .filter((link) => link.label !== "Contact")
              .map((link) => (
                <motion.li key={link.label} variants={navItemVariants}>
                  <Link href={link.href} className="mobile-nav-link focus-ring-light block" onClick={onClose}>
                    {link.label}
                  </Link>
                </motion.li>
              ))}

            <motion.li variants={navItemVariants} className="mt-6">
              <button
                type="button"
                className="hero-cta-btn gold-ring focus-ring-light w-full max-w-sm cursor-pointer min-h-14 px-8 py-4 text-base font-semibold tracking-wide text-black"
                onClick={() => {
                  onJoinCommunityClick();
                  onClose();
                }}
              >
                Join Our Community
              </button>
            </motion.li>
          </motion.ul>

          {/* Bottom logo + org name */}
          <motion.div
            className="flex flex-col items-center gap-2 pb-2 pt-6"
            variants={navItemVariants}
          >
            <Image src={asoscLogo} alt="ASOSC" className="h-20 w-auto" />
            <span className="mobile-nav-org-name">Africans Society of Strathcona County</span>
          </motion.div>
        </div>
      </motion.div>
    </motion.nav>
  );
}
