"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  MobileMenuToggle,
  MobileNavMenu,
  type GalleryProgram,
} from "@/components/mobile-nav-menu";
import { JoinCommunityModal } from "@/components/join-community-modal";
import { NAV_TEXTURE_URL } from "@/lib/nav-texture";

const NAVBAR_IMAGE_OPACITY = 0.95;

const navbarBackgroundStyle = {
  backgroundImage: `url(${NAV_TEXTURE_URL})`,
  backgroundRepeat: "repeat" as const,
  opacity: NAVBAR_IMAGE_OPACITY,
};

function hashId(href: string) {
  return href.slice(href.indexOf("#") + 1);
}

const navLinkClassName = "nav-menu-trigger focus-ring cursor-pointer";
const navLinkWithIconClassName = `${navLinkClassName} gap-1.5`;

const programsDropdown = [
  {
    title: "Our Story, Our Voice",
    description: "Stories that build empathy and challenge stereotypes.",
    href: "/#our-story",
  },
  {
    title: "Youth Creative Lab",
    description: "Raising the next generation of African leaders.",
    href: "/#youth-lab",
  },
  {
    title: "African Festival",
    description: "Celebrating African culture, food, music, and identity.",
    href: "/#festival",
  },
  {
    title: "Black History Month",
    description: "Honoring heritage and celebrating achievements.",
    href: "/#bhm",
  },
  {
    title: "Family Wellness Programs",
    description: "Supporting strong, healthy African families.",
    href: "/#wellness",
  },
];

export const galleryDropdown: GalleryProgram[] = [
  {
    program: "African Festival",
    years: [
      { year: "2025", href: "/#gallery" },
      { year: "2024", href: "/#gallery" },
    ],
  },
  {
    program: "Black History Month",
    years: [
      { year: "2025", href: "/#gallery" },
      { year: "2024", href: "/#gallery" },
    ],
  },
  {
    program: "Youth Creative Lab",
    years: [{ year: "2025", href: "/#gallery" }],
  },
  {
    program: "Family Wellness Seminars",
    years: [{ year: "2025", href: "/#gallery" }],
  },
  {
    program: "End-of-Year/Volunteer Appreciation Party",
    years: [{ year: "2025", href: "/#gallery" }],
  },
];

const leftLinks = [
  { label: "Home", href: "/#home" },
  { label: "About", href: "/#about" },
];

const rightLinks = [
  { label: "Calendar", href: "/#calendar" },
  { label: "Contact", href: "/#contact" },
];

const DROPDOWN_EASE = [0.65, 0.01, 0.05, 0.99] as const;

const panelVariants = {
  hidden: { opacity: 0, y: -6, scale: 0.98 },
  visible: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.18, ease: [0.16, 1, 0.3, 1] as const } },
  exit:   { opacity: 0, y: -4, scale: 0.98, transition: { duration: 0.13, ease: "easeIn" as const } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 8, rotate: 4 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    rotate: 0,
    transition: { delay: 0.18 + i * 0.05, duration: 0.35, ease: DROPDOWN_EASE },
  }),
  exit: { opacity: 0, transition: { duration: 0.1 } },
};

function DropdownChevron({ open }: { open: boolean }) {
  return (
    <motion.svg
      animate={{ rotate: open ? 180 : 0 }}
      transition={{ duration: 0.2, ease: "easeInOut" }}
      className="h-3.5 w-3.5 shrink-0"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth="2.5"
      stroke="currentColor"
      aria-hidden
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
    </motion.svg>
  );
}

function useNavbarKeyboard(
  mobileMenuOpen: boolean,
  setMobileMenuOpen: (open: boolean) => void,
  setProgramsOpen: (open: boolean) => void,
  setGalleryOpen: (open: boolean) => void,
) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMobileMenuOpen(false);
        setProgramsOpen(false);
        setGalleryOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [setMobileMenuOpen, setProgramsOpen, setGalleryOpen]);

  useEffect(() => {
    if (!mobileMenuOpen) return;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, [mobileMenuOpen]);
}

function NavbarBackground() {
  return (
    <div
      className="absolute inset-0"
      style={navbarBackgroundStyle}
      aria-hidden="true"
    />
  );
}

const SECTION_IDS = ["home", "about", "programs", "gallery", "calendar", "contact"];

function NavLamp() {
  return (
    <motion.div
      layoutId="nav-lamp"
      className="pointer-events-none absolute inset-x-0 -bottom-2 flex justify-center text-(--yellow)"
      initial={false}
      transition={{ type: "spring", stiffness: 350, damping: 30 }}
    >
      <div className="relative h-1 w-10 rounded-full bg-current">
        <div className="absolute -left-2 -top-2 h-6 w-14 rounded-full bg-current/40 blur-md" />
        <div className="absolute -top-1 left-1 h-6 w-8 rounded-full bg-current/40 blur-md" />
        <div className="absolute left-3 top-0 h-4 w-4 rounded-full bg-current/40 blur-sm" />
      </div>
    </motion.div>
  );
}

export function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const isHome = pathname === "/";
  const [programsOpen, setProgramsOpen] = useState(false);
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeSection, setActiveSection] = useState("home");
  const [hoveredNav, setHoveredNav] = useState<string | null>(null);
  const [showJoinNav, setShowJoinNav] = useState(false);
  const [isJoinModalOpen, setIsJoinModalOpen] = useState(false);
  const [joinModalAction, setJoinModalAction] = useState<string | null>(null);
  const lampTarget = hoveredNav ?? activeSection;
  const [togglePos, setTogglePos] = useState({ x: 0, y: 0 });
  const toggleButtonRef = useRef<HTMLButtonElement>(null);
  const logoLinkRef = useRef<HTMLAnchorElement>(null);
  const programsCloseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const galleryCloseTimer  = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // Expose the real navbar logo element so LoadingScreen can measure it exactly
    (window as Window & { __navLogoEl?: HTMLElement }).__navLogoEl = logoLinkRef.current ?? undefined;
  }, []);
  useNavbarKeyboard(mobileMenuOpen, setMobileMenuOpen, setProgramsOpen, setGalleryOpen);

  useEffect(() => {
    const handleHeroCtaPastView = (event: Event) => {
      const { past } = (event as CustomEvent<{ past: boolean }>).detail;
      setShowJoinNav(past);
    };
    window.addEventListener("heroCtaPastView", handleHeroCtaPastView);
    return () => window.removeEventListener("heroCtaPastView", handleHeroCtaPastView);
  }, []);

  useEffect(() => {
    if (!isHome) {
      setActiveSection(pathname === "/about" ? "about" : "home");
      return;
    }

    const sections = SECTION_IDS.map((id) => document.getElementById(id)).filter(
      (el): el is HTMLElement => el !== null,
    );

    const handleScroll = () => {
      const scrollPos = window.scrollY + window.innerHeight / 2;
      const atBottom =
        window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2;

      if (atBottom) {
        setActiveSection(SECTION_IDS[SECTION_IDS.length - 1]);
        return;
      }

      for (const section of sections) {
        const top = section.getBoundingClientRect().top + window.scrollY;
        const bottom = top + section.offsetHeight;
        if (scrollPos >= top && scrollPos < bottom) {
          setActiveSection(section.id);
          break;
        }
      }
    };

    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    window.addEventListener("resize", handleScroll);
    return () => {
      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener("resize", handleScroll);
    };
  }, [isHome, pathname]);

  const updateTogglePos = useCallback(() => {
    const el = toggleButtonRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setTogglePos({ x: r.left + r.width / 2, y: r.top + r.height / 2 });
  }, []);

  useEffect(() => {
    updateTogglePos();
    window.addEventListener("resize", updateTogglePos);
    return () => window.removeEventListener("resize", updateTogglePos);
  }, [updateTogglePos]);

  const toggleMobileMenu = () => {
    updateTogglePos();
    setMobileMenuOpen((open) => {
      if (open) { setProgramsOpen(false); setGalleryOpen(false); }
      return !open;
    });
  };

  const closeMobileMenu = () => {
    setMobileMenuOpen(false);
    setProgramsOpen(false);
    setGalleryOpen(false);
  };

  return (
    <header className="fixed inset-x-0 top-0 z-(--z-navbar)">
      <div className="relative">
        <div className="absolute inset-0 overflow-hidden" aria-hidden>
          <NavbarBackground />
        </div>
        <nav className="relative z-10 mx-auto max-w-7xl overflow-visible px-4 sm:px-6 lg:px-8 text-white">
          <div
            className="relative flex h-20 items-center justify-between"
            onMouseLeave={() => setHoveredNav(null)}
          >
            {/* Left spacer for mobile balance */}
            <div className="lg:hidden w-11" />

            {/* Left navigation */}
            <div className="hidden lg:flex lg:items-center lg:gap-6">
              {leftLinks.map((link) => {
                const id = hashId(link.href);
                return (
                  <div
                    key={link.label}
                    className="relative"
                    onMouseEnter={() => setHoveredNav(id)}
                  >
                    <Link
                      href={link.href}
                      className={navLinkClassName}
                      data-active={lampTarget === id ? "true" : undefined}
                    >
                      {link.label}
                    </Link>
                    {lampTarget === id && <NavLamp />}
                  </div>
                );
              })}

              {/* Programs dropdown */}
              <div
                className="relative"
                onMouseEnter={() => {
                  if (programsCloseTimer.current) clearTimeout(programsCloseTimer.current);
                  if (galleryCloseTimer.current)  clearTimeout(galleryCloseTimer.current);
                  setProgramsOpen(true);
                  setGalleryOpen(false);
                  setHoveredNav("programs");
                }}
                onMouseLeave={() => {
                  programsCloseTimer.current = setTimeout(() => setProgramsOpen(false), 150);
                }}
              >
                <button
                  type="button"
                  className={navLinkWithIconClassName}
                  data-open={programsOpen ? "true" : undefined}
                  data-active={lampTarget === "programs" ? "true" : undefined}
                  aria-expanded={programsOpen}
                  aria-haspopup="true"
                  onClick={() => {
                    if (isHome) {
                      document.getElementById("programs")?.scrollIntoView({ behavior: "smooth" });
                    } else {
                      router.push("/#programs");
                    }
                    setProgramsOpen(false);
                  }}
                >
                  Programs
                  <DropdownChevron open={programsOpen} />
                </button>
                {lampTarget === "programs" && <NavLamp />}

                <AnimatePresence>
                  {programsOpen && (
                    <motion.div
                      variants={panelVariants}
                      initial="hidden"
                      animate="visible"
                      exit="exit"
                      className="programs-panel absolute left-0 top-full z-(--z-dropdown) mt-3"
                      role="menu"
                    >
                      {/* Bridge to maintain hover state across the mt-3 gap */}
                      <div className="absolute -top-3 left-0 right-0 h-3" />

                      <ul className="grid gap-2 p-2.5 sm:grid-cols-2">
                        {programsDropdown.map((program, i) => (
                          <motion.li
                            key={program.title}
                            custom={i}
                            variants={itemVariants}
                          >
                            <button
                              type="button"
                              role="menuitem"
                              className="program-card focus-ring-light w-full text-left"
                              onClick={() => {
                                const bentoHref = program.href.replace(/^\//, "");
                                if (isHome) {
                                  window.dispatchEvent(new CustomEvent("openProgram", { detail: { href: bentoHref } }));
                                  document.getElementById("programs")?.scrollIntoView({ behavior: "smooth" });
                                } else {
                                  router.push(program.href);
                                }
                                setProgramsOpen(false);
                              }}
                            >
                              <div className="min-w-0 flex-1">
                                <div className="program-card__title">{program.title}</div>
                                <p className="program-card__desc">{program.description}</p>
                              </div>
                            </button>
                          </motion.li>
                        ))}
                      </ul>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>

            {/* Center logo */}
            <Link
              ref={logoLinkRef}
              href="/#home"
              className="focus-ring absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 cursor-pointer rounded-sm"
            >
              <Image src="https://res.cloudinary.com/daldas2e7/image/upload/v1782010314/asosc/logo.webp" alt="ASOSC logo" width={112} height={112} className="h-14 w-auto" priority />
            </Link>

            {/* Right navigation */}
            <div className="hidden lg:ml-auto lg:flex lg:items-center lg:gap-6">
              {/* Gallery link */}
              <div className="relative">
                <Link
                  href="/#gallery"
                  className={navLinkClassName}
                  data-active={lampTarget === "gallery" ? "true" : undefined}
                  onClick={() => {
                    if (isHome) {
                      document.getElementById("gallery")?.scrollIntoView({ behavior: "smooth" });
                    }
                  }}
                >
                  Gallery
                </Link>
                {lampTarget === "gallery" && <NavLamp />}
              </div>

              {rightLinks.map((link) => {
                const id = hashId(link.href);

                if (link.label === "Contact" && showJoinNav) {
                  return (
                    <motion.button
                      key={link.label}
                      type="button"
                      onClick={() => {
                        setJoinModalAction(null);
                        setIsJoinModalOpen(true);
                      }}
                      initial={{ opacity: 0, scale: 0.8, x: 16 }}
                      animate={{ opacity: 1, scale: 1, x: 0 }}
                      transition={{ type: "spring", stiffness: 350, damping: 22 }}
                      className="hero-cta-btn gold-ring focus-ring-light cursor-pointer px-5 py-2 text-sm font-semibold tracking-wide text-black transition-colors duration-200 ease-out"
                    >
                      Join Our Community
                    </motion.button>
                  );
                }

                if (link.label === "Contact") {
                  return (
                    <div
                      key={link.label}
                      className="relative"
                      onMouseEnter={() => setHoveredNav(id)}
                    >
                      <button
                        type="button"
                        onClick={() => {
                          setJoinModalAction("Contact");
                          setIsJoinModalOpen(true);
                        }}
                        className={navLinkClassName}
                        data-active={lampTarget === id ? "true" : undefined}
                      >
                        {link.label}
                      </button>
                      {lampTarget === id && <NavLamp />}
                    </div>
                  );
                }

                return (
                  <div
                    key={link.label}
                    className="relative"
                    onMouseEnter={() => setHoveredNav(id)}
                  >
                    <Link
                      href={link.href}
                      className={navLinkClassName}
                      data-active={lampTarget === id ? "true" : undefined}
                    >
                      {link.label}
                    </Link>
                    {lampTarget === id && <NavLamp />}
                  </div>
                );
              })}
            </div>

            <MobileMenuToggle
              isOpen={mobileMenuOpen}
              onToggle={toggleMobileMenu}
              ref={toggleButtonRef}
            />
          </div>
        </nav>
      </div>

      <MobileNavMenu
        isOpen={mobileMenuOpen}
        onClose={closeMobileMenu}
        programsOpen={programsOpen}
        setProgramsOpen={setProgramsOpen}
        galleryOpen={galleryOpen}
        setGalleryOpen={setGalleryOpen}
        leftLinks={leftLinks}
        rightLinks={rightLinks}
        programs={programsDropdown}
        gallery={galleryDropdown}
        toggleX={togglePos.x}
        toggleY={togglePos.y}
        onJoinCommunityClick={() => {
          setJoinModalAction(null);
          setIsJoinModalOpen(true);
        }}
      />

      <JoinCommunityModal
        isOpen={isJoinModalOpen}
        onClose={() => setIsJoinModalOpen(false)}
        initialAction={joinModalAction}
      />
    </header>
  );
}
