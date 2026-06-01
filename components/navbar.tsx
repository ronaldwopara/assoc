"use client";

import Image from "next/image";
import Link from "next/link";
import { useState, useEffect, useRef, useCallback } from "react";
import {
  MobileMenuToggle,
  MobileNavMenu,
} from "@/components/mobile-nav-menu";
import asoscLogo from "../Asosc-Logo.png";

/** Navbar background image strength (0–1). Raise toward 1 for a bolder pattern. */
const NAVBAR_IMAGE_OPACITY = 0.95;

const navbarBackgroundStyle = {
  backgroundImage: "url(/navbar.png)",
  backgroundRepeat: "repeat" as const,
  opacity: NAVBAR_IMAGE_OPACITY,
};

const navLinkClassName = "nav-menu-trigger focus-ring cursor-pointer";

const navLinkWithIconClassName = `${navLinkClassName} gap-1`;

const programsDropdown = [
  {
    title: "Our Story, Our Voice",
    description: "Stories that build empathy and challenge stereotypes.",
    href: "#our-story",
  },
  {
    title: "Youth Creative Media Lab",
    description: "Raising the next generation of African leaders.",
    href: "#youth-lab",
  },
  {
    title: "African Festival",
    description: "Celebrating African culture, food, music, and identity.",
    href: "#festival",
  },
  {
    title: "Black History Month",
    description: "Honoring heritage and celebrating achievements.",
    href: "#bhm",
  },
  {
    title: "Family Wellness Programs",
    description: "Supporting strong, healthy African families.",
    href: "#wellness",
  },
];

const leftLinks = [
  { label: "Home", href: "#home" },
  { label: "About", href: "#about" },
];

const rightLinks = [
  { label: "Gallery", href: "#gallery" },
  { label: "Get Involved", href: "#get-involved" },
  { label: "Contact", href: "#contact" },
];

function useNavbarKeyboard(
  mobileMenuOpen: boolean,
  setMobileMenuOpen: (open: boolean) => void,
  setProgramsOpen: (open: boolean) => void
) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMobileMenuOpen(false);
        setProgramsOpen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [setMobileMenuOpen, setProgramsOpen]);

  useEffect(() => {
    document.body.style.overflow = mobileMenuOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileMenuOpen]);
}

function NavbarBackground() {
  return <div className="absolute inset-0" style={navbarBackgroundStyle} />;
}

export function Navbar() {
  const [programsOpen, setProgramsOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [togglePos, setTogglePos] = useState({ x: 28, y: 40 });
  const toggleButtonRef = useRef<HTMLButtonElement>(null);
  useNavbarKeyboard(mobileMenuOpen, setMobileMenuOpen, setProgramsOpen);

  const updateTogglePos = useCallback(() => {
    const el = toggleButtonRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setTogglePos({ x: r.left + r.width / 2, y: r.top + r.height / 2 });
  }, []);

  const toggleMobileMenu = () => {
    updateTogglePos();
    setMobileMenuOpen((open) => {
      if (open) setProgramsOpen(false);
      return !open;
    });
  };

  const closeMobileMenu = () => {
    setMobileMenuOpen(false);
    setProgramsOpen(false);
  };

  return (
    <header className="fixed inset-x-0 top-0 z-[var(--z-navbar)]">
      <div className="relative">
        <div className="absolute inset-0 overflow-hidden" aria-hidden>
          <NavbarBackground />
        </div>
        <nav className="relative z-10 mx-auto max-w-7xl overflow-visible px-4 sm:px-6 lg:px-8 text-white">
          <div className="flex h-20 items-center justify-between">
            <MobileMenuToggle
              isOpen={mobileMenuOpen}
              onToggle={toggleMobileMenu}
              ref={toggleButtonRef}
            />


            {/* Left navigation */}
            <div className="hidden lg:flex lg:items-center lg:gap-8">
              {leftLinks.map((link) => (
                <Link
                  key={link.label}
                  href={link.href}
                  className={navLinkClassName}
                >
                  {link.label}
                </Link>
              ))}

              {/* Programs dropdown */}
              <div
                className="relative"
                onMouseEnter={() => setProgramsOpen(true)}
                onMouseLeave={() => setProgramsOpen(false)}
              >
                <Link
                  href="#programs"
                  className={navLinkWithIconClassName}
                  data-open={programsOpen ? "true" : undefined}
                  aria-expanded={programsOpen}
                  aria-haspopup="true"
                >
                  Programs
                  <svg
                    className={`h-4 w-4 shrink-0 transition-transform duration-200 ${programsOpen ? "rotate-180" : ""}`}
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth="2"
                    stroke="currentColor"
                    aria-hidden
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M19 9l-7 7-7-7"
                    />
                  </svg>
                </Link>

                {programsOpen && (
                  <div
                    className="nav-menu-content absolute left-0 top-full z-[var(--z-dropdown)] mt-2 w-[min(36rem,calc(100vw-2rem))]"
                    role="menu"
                  >
                    <ul className="grid gap-3 sm:grid-cols-2">
                      {programsDropdown.map((program) => (
                        <li key={program.title}>
                          <Link
                            href={program.href}
                            role="menuitem"
                            className="nav-menu-item focus-ring-light cursor-pointer"
                          >
                            <div className="nav-menu-item-title">
                              {program.title}
                            </div>
                            <p className="nav-menu-item-desc">
                              {program.description}
                            </p>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>

            {/* Center logo */}
            <Link
              href="#home"
              className="focus-ring shrink-0 cursor-pointer rounded-sm"
            >
              <Image
                src={asoscLogo}
                alt="ASOSC logo"
                className="h-14 w-auto"
                priority
              />
            </Link>

            {/* Right navigation */}
            <div className="hidden lg:flex lg:items-center lg:gap-8">
              {rightLinks.map((link) => (
                <Link
                  key={link.label}
                  href={link.href}
                  className={navLinkClassName}
                >
                  {link.label}
                </Link>
              ))}
            </div>

            {/* Spacer for mobile */}
            <div className="lg:hidden w-10" />
          </div>
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
        toggleX={togglePos.x}
        toggleY={togglePos.y}
      />
    </header>
  );
}
