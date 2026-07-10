"use client";

import Image from "next/image";
import Link from "next/link";
import dynamic from "next/dynamic";
import { usePathname, useRouter } from "next/navigation";
import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence, LayoutGroup } from "framer-motion";
import {
  MobileMenuToggle,
  MobileNavMenu,
  type GalleryProgram,
} from "@/components/mobile-nav-menu";
import { getGalleryDropdown } from "@/lib/gallery-categories";
import { getEventsNavHref } from "@/lib/events-nav";
import {
  GALLERY_BOTTOM_HASH,
  GALLERY_BOTTOM_HREF,
  scrollGalleryToBottom,
} from "@/lib/gallery-scroll";
import { SETTLEMENT_WELLBEING_TITLE } from "@/lib/program-names";
import { handleSectionLinkClick, normalizeLegacyEventsHash } from "@/lib/section-link";
import { ABOUT_US_LOGO_URL } from "@/components/section-logo-heading";

// Not needed until a CTA is clicked — keep it out of the navbar's initial chunk.
const JoinCommunityModal = dynamic(
  () => import("@/components/join-community-modal").then((m) => m.JoinCommunityModal),
  { ssr: false },
);

const NAVBAR_LOGO_URL = ABOUT_US_LOGO_URL;

function hashId(href: string) {
  const hashIndex = href.indexOf("#");
  if (hashIndex < 0) return href.replace(/^\//, "") || "home";
  return href.slice(hashIndex + 1);
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
    title: SETTLEMENT_WELLBEING_TITLE,
    description: "Supporting strong, healthy African families.",
    href: "/#wellness",
  },
];

const galleryDropdown: GalleryProgram[] = getGalleryDropdown();

const leftLinks = [
  { label: "Home", href: "/#home" },
  { label: "About", href: "/#about" },
];

const contactLink = { label: "Contact", href: "/#contact" };

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
  closeMobileMenu: () => void,
) {
  const closeRef = useRef(closeMobileMenu);
  closeRef.current = closeMobileMenu;

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeRef.current();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  useEffect(() => {
    if (!mobileMenuOpen) return;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, [mobileMenuOpen]);
}

function NavbarBackground() {
  return (
    <div
      className="navbar-shell site-header__backdrop absolute"
      aria-hidden="true"
    />
  );
}

const SECTION_IDS = ["home", "about", "programs", "gallery", "events", "contact"];

function routeActiveSection(pathname: string) {
  if (pathname === "/about") return "about";
  if (pathname === "/events") return "events";
  return "home";
}

function NavLamp({ instant = false }: { instant?: boolean }) {
  return (
    <motion.div
      layoutId="nav-lamp"
      className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-center text-(--orange)"
      initial={false}
      transition={
        instant
          ? { duration: 0 }
          : { type: "spring", stiffness: 350, damping: 30 }
      }
    >
      <div className="h-1 w-10 rounded-full bg-current" />
    </motion.div>
  );
}

export function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const isHome = pathname === "/";
  const eventsNavHref = getEventsNavHref(isHome);
  const rightLinks = [
    { label: "Events", href: eventsNavHref },
    contactLink,
  ];
  const [programsOpen, setProgramsOpen] = useState(false);
  const [, setGalleryOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeSection, setActiveSection] = useState(() => routeActiveSection(pathname));
  const [hoveredNav, setHoveredNav] = useState<string | null>(null);
  const [lampInstant, setLampInstant] = useState(true);
  const [showJoinNav, setShowJoinNav] = useState(false);
  const [isJoinModalOpen, setIsJoinModalOpen] = useState(false);
  const [joinModalAction, setJoinModalAction] = useState<string | null>(null);
  const hasOpenedJoinModalRef = useRef(false);
  hasOpenedJoinModalRef.current ||= isJoinModalOpen;
  const navActiveSection = isHome ? activeSection : routeActiveSection(pathname);
  const lampTarget = hoveredNav ?? navActiveSection;
  const shouldShowJoinNav = !isHome || showJoinNav;
  const [togglePos, setTogglePos] = useState({ x: 0, y: 0 });
  const toggleButtonRef = useRef<HTMLButtonElement>(null);
  const logoLinkRef = useRef<HTMLAnchorElement>(null);
  const programsCloseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const galleryCloseTimer  = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // Expose the real navbar logo element so LoadingScreen can measure it exactly
    (window as Window & { __navLogoEl?: HTMLElement }).__navLogoEl = logoLinkRef.current ?? undefined;
  }, []);
  const closeMobileMenu = useCallback(() => {
    // Move focus out of the panel before aria-hidden is applied on close.
    toggleButtonRef.current?.focus({ preventScroll: true });
    setMobileMenuOpen(false);
    setProgramsOpen(false);
    setGalleryOpen(false);
  }, []);

  useNavbarKeyboard(mobileMenuOpen, closeMobileMenu);

  useEffect(() => {
    const handleHeroCtaPastView = (event: Event) => {
      const { past } = (event as CustomEvent<{ past: boolean }>).detail;
      setShowJoinNav(past);
    };
    window.addEventListener("heroCtaPastView", handleHeroCtaPastView);
    return () => window.removeEventListener("heroCtaPastView", handleHeroCtaPastView);
  }, []);

  useEffect(() => {
    setLampInstant(true);
    const raf = requestAnimationFrame(() => setLampInstant(false));
    return () => cancelAnimationFrame(raf);
  }, [pathname]);

  useEffect(() => {
    if (!isHome) return;
    normalizeLegacyEventsHash();
  }, [isHome]);

  useEffect(() => {
    if (!isHome) return;

    const handleGalleryBottomHash = () => {
      if (window.location.hash !== GALLERY_BOTTOM_HASH) return;
      requestAnimationFrame(() => scrollGalleryToBottom());
    };

    handleGalleryBottomHash();
    window.addEventListener("hashchange", handleGalleryBottomHash);
    return () => window.removeEventListener("hashchange", handleGalleryBottomHash);
  }, [isHome]);

  useEffect(() => {
    if (!isHome) return;
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

  return (
    <header className="site-header fixed inset-x-0 top-0 z-(--z-navbar)">
      <div className="relative">
        <div className="absolute inset-0 overflow-hidden" aria-hidden>
          <NavbarBackground />
        </div>
        <nav className="relative z-10 mx-auto max-w-7xl overflow-visible px-4 sm:px-6 lg:px-8 text-(--ink)">
          <LayoutGroup id={pathname}>
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
                      onClick={(event) => handleSectionLinkClick(event, link.href, isHome)}
                    >
                      {link.label}
                    </Link>
                    {lampTarget === id && <NavLamp instant={lampInstant} />}
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
                {lampTarget === "programs" && <NavLamp instant={lampInstant} />}

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
              onClick={(event) => handleSectionLinkClick(event, "/#home", isHome)}
            >
              <Image src={NAVBAR_LOGO_URL} alt="ASOSC logo" width={128} height={128} className="nav-logo-image h-18 w-auto" priority />
            </Link>

            {/* Right navigation */}
            <div className="hidden lg:ml-auto lg:flex lg:items-center lg:gap-6">
              {/* Gallery link */}
              <div
                className="relative"
                onMouseEnter={() => setHoveredNav("gallery")}
              >
                <Link
                  href={GALLERY_BOTTOM_HREF}
                  className={navLinkClassName}
                  data-active={lampTarget === "gallery" ? "true" : undefined}
                  onClick={(event) => handleSectionLinkClick(event, GALLERY_BOTTOM_HREF, isHome)}
                >
                  Gallery
                </Link>
                {lampTarget === "gallery" && <NavLamp instant={lampInstant} />}
              </div>

              {rightLinks.map((link) => {
                const id = hashId(link.href);

                if (link.label === "Contact" && shouldShowJoinNav) {
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
                      {lampTarget === id && <NavLamp instant={lampInstant} />}
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
                      onClick={(event) => handleSectionLinkClick(event, link.href, isHome)}
                    >
                      {link.label}
                    </Link>
                    {lampTarget === id && <NavLamp instant={lampInstant} />}
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
          </LayoutGroup>
        </nav>
      </div>

      <MobileNavMenu
        isOpen={mobileMenuOpen}
        onClose={closeMobileMenu}
        programsOpen={programsOpen}
        setProgramsOpen={setProgramsOpen}
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

      {hasOpenedJoinModalRef.current && (
        <JoinCommunityModal
          isOpen={isJoinModalOpen}
          onClose={() => setIsJoinModalOpen(false)}
          initialAction={joinModalAction}
        />
      )}
    </header>
  );
}
