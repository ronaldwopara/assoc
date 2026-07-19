"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import dynamic from "next/dynamic";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import { SectionLogoHeading } from "@/components/section-logo-heading";
import {
  AFRICAN_FESTIVAL_VOLUNTEER_FORM_URL,
  BLACK_HISTORY_MONTH_REGISTER_FORM_URL,
  BLACK_HISTORY_MONTH_VOLUNTEER_FORM_URL,
  END_OF_YEAR_FORM_URL,
  FAMILY_WELLNESS_FORM_URL,
  YOUTH_CREATIVE_LAB_FORM_URL,
} from "@/lib/external-links";
import type { MediaItemType } from "@/lib/featured-programs-data";
import { SETTLEMENT_WELLBEING_TITLE } from "@/lib/program-names";

// Not needed until a CTA is clicked — keep it out of the gallery's initial chunk.
const JoinCommunityModal = dynamic(
  () => import("@/components/join-community-modal").then((m) => m.JoinCommunityModal),
  { ssr: false },
);

const ctaClassName =
  "hero-cta-btn focus-ring-light inline-flex min-h-14 cursor-pointer items-center justify-center px-10 py-4 text-base font-semibold tracking-wide text-black transition duration-200 ease-out";
const drawerCtaClassName =
  "hero-cta-btn focus-ring-light inline-flex min-h-12 min-w-0 flex-1 cursor-pointer items-center justify-center px-4 py-3 text-sm font-semibold tracking-wide text-black transition duration-200 ease-out sm:min-h-14 sm:flex-none sm:px-10 sm:py-4 sm:text-base";
type ProgramActionLink = { label: "Register" | "Volunteer"; href: string };

const programActionLinks: Partial<Record<string, ProgramActionLink[]>> = {
  "African Festival": [
    {
      label: "Volunteer",
      href: AFRICAN_FESTIVAL_VOLUNTEER_FORM_URL,
    },
  ],
  "Black History Month": [
    {
      label: "Register",
      href: BLACK_HISTORY_MONTH_REGISTER_FORM_URL,
    },
    {
      label: "Volunteer",
      href: BLACK_HISTORY_MONTH_VOLUNTEER_FORM_URL,
    },
  ],
  "End-of-Year/Volunteer Appreciation Party": [
    {
      label: "Register",
      href: END_OF_YEAR_FORM_URL,
    },
  ],
  [SETTLEMENT_WELLBEING_TITLE]: [
    {
      label: "Register",
      href: FAMILY_WELLNESS_FORM_URL,
    },
  ],
  "Youth Creative Lab": [
    {
      label: "Register",
      href: YOUTH_CREATIVE_LAB_FORM_URL,
    },
  ],
};

function MediaItem({
  item,
  className,
  onClick,
}: {
  item: MediaItemType;
  className?: string;
  onClick?: () => void;
}) {
  if (item.type === "video") {
    return (
      <div className={`${className ?? ""} relative overflow-hidden`}>
        <video
          className="h-full w-full object-cover"
          onClick={onClick}
          src={item.url}
          muted
          loop
          autoPlay
          playsInline
          preload="metadata"
          aria-hidden={onClick ? undefined : true}
        />
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={item.url}
      alt={item.title}
      className={`${className ?? ""} cursor-pointer object-cover`}
      onClick={onClick}
      loading="lazy"
      decoding="async"
    />
  );
}

function GalleryModal({
  selectedItem,
  isOpen,
  onClose,
  setSelectedItem,
  mediaItems,
  onRegister,
  onVolunteer,
}: {
  selectedItem: MediaItemType;
  isOpen: boolean;
  onClose: (options?: { restoreScroll?: boolean }) => void;
  setSelectedItem: (item: MediaItemType | null) => void;
  mediaItems: MediaItemType[];
  onRegister: (programTitle: string) => void;
  onVolunteer: (programTitle: string) => void;
}) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const drawerRef = useRef<HTMLDivElement>(null);
  const learnMoreRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    setDrawerOpen(false);
  }, [selectedItem.id]);

  useEffect(() => {
    if (!drawerOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (learnMoreRef.current?.contains(target)) return;
      if (drawerRef.current?.contains(target)) return;
      setDrawerOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [drawerOpen]);

  const currentIndex = mediaItems.findIndex((item) => item.id === selectedItem.id);
  const prevItem = mediaItems[currentIndex - 1] ?? null;
  const nextItem = mediaItems[currentIndex + 1] ?? null;

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft" && prevItem) setSelectedItem(prevItem);
      if (e.key === "ArrowRight" && nextItem) setSelectedItem(nextItem);
      if (e.key === "Escape") {
        if (drawerOpen) setDrawerOpen(false);
        else onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [prevItem, nextItem, setSelectedItem, onClose, drawerOpen]);

  if (!isOpen) return null;
  const actionLinks = programActionLinks[selectedItem.title];

  return (
    <div
      className="fixed inset-x-0 bottom-0 top-(--header-height) z-40 flex flex-col overflow-x-hidden bg-black pb-(--safe-bottom)"
      role="dialog"
      aria-modal="true"
      aria-label={selectedItem.title}
    >
      <div className="relative z-10 flex min-h-0 flex-1 flex-col overflow-x-hidden sm:px-6 lg:px-10">
      {/* Card */}
      <motion.div
        initial={{ scale: 0.97, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.97, opacity: 0 }}
        transition={{ type: "spring", stiffness: 400, damping: 30 }}
        className="relative mx-auto flex min-h-0 w-full flex-1 flex-col overflow-hidden rounded-t-2xl max-[629px]:rounded-t-none sm:my-4 sm:max-w-5xl sm:rounded-2xl md:my-8 lg:max-w-[90rem]"
      >
        {/* Full-bleed media */}
        <AnimatePresence mode="wait">
          <motion.div
            key={selectedItem.id}
            className="absolute inset-0"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
          >
            <MediaItem item={selectedItem} className="h-full w-full object-cover" />
          </motion.div>
        </AnimatePresence>

        {/* Gradient overlay */}
        <div className="pointer-events-none absolute inset-0 bg-linear-to-t from-black/80 via-black/35 to-black/25" />

        {/* Close button — top left */}
        <motion.button
          type="button"
          className={`focus-ring-light absolute left-4 top-4 z-50 text-(--yellow) transition-colors duration-150 hover:text-(--yellow-dark) ${drawerOpen ? "hidden lg:block" : ""}`}
          onClick={() => onClose()}
          aria-label="Close"
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
        >
          <X size={26} />
        </motion.button>

        {/* Hero text overlay */}
        <AnimatePresence mode="wait">
          <motion.div
            key={selectedItem.id}
            className={`pointer-events-none absolute inset-0 z-50 ${drawerOpen ? "hidden lg:flex" : "flex"} flex-col items-start justify-center pb-28 pl-6 pr-20 text-left text-white sm:pl-12 sm:pr-24 lg:pl-16`}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.3, delay: 0.1 }}
          >
            <div className="pointer-events-auto w-full max-w-2xl">
              <h2 className="wrap-break-word text-[clamp(1.75rem,4vw,3.25rem)] font-bold uppercase leading-[1.1] tracking-wide drop-shadow-[0_1px_8px_rgba(0,0,0,0.45)]">
                {selectedItem.title}
              </h2>
              <p className="mt-4 max-w-152 text-base font-normal leading-relaxed text-white/90 sm:text-lg">
                {selectedItem.desc}
              </p>
              <button
                ref={learnMoreRef}
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setDrawerOpen((v) => !v);
                }}
                className={`${ctaClassName} pointer-events-auto relative z-50 mt-6`}
              >
                Learn More
              </button>
            </div>
          </motion.div>
        </AnimatePresence>

        {/* Side sheet — outer div sizes the panel, inner div handles slide.
            pointer-events-none on the outer so the full-width container doesn't
            block the close button; pointer-events-auto restored on the inner
            (translated) div so only the visible area receives touches. */}
        <div
          className="pointer-events-none absolute inset-0 z-30 lg:inset-y-0 lg:inset-x-auto lg:right-0 lg:w-126"
        >
          <motion.div
            ref={drawerRef}
            className="pointer-events-auto flex h-full w-full"
            animate={{ x: drawerOpen ? 0 : "calc(100% - 3.5rem)" }}
            transition={{ type: "spring", stiffness: 300, damping: 35 }}
          >
          {/* Orange tab strip — always visible, acts as the toggle */}
          <button
            type="button"
            onClick={() => setDrawerOpen((v) => !v)}
            aria-label={drawerOpen ? "Close details" : "Program details"}
            className="flex w-16 shrink-0 cursor-pointer flex-row items-center justify-center gap-2 overflow-hidden py-6 transition-opacity hover:opacity-90"
            style={{ background: "var(--orange-dark)" }}
          >
            <div className="h-18 w-1 rounded-full bg-white/40" />
            <span
              className="select-none text-[0.78rem] font-bold uppercase tracking-[0.22em] text-white/80"
              style={{ writingMode: "vertical-rl", transform: "rotate(180deg)" }}
            >
              Description
            </span>
          </button>

          {/* Content panel */}
          <div className="relative flex flex-1 flex-col overflow-hidden" style={{ background: "#fff7ed" }}>
            <button
              type="button"
              onClick={() => setDrawerOpen(false)}
              aria-label="Close details"
              className="absolute right-4 top-4 z-10 flex h-8 w-8 items-center justify-center rounded-full text-(--yellow) transition-colors hover:bg-black/5 hover:text-(--yellow-dark) lg:hidden"
            >
              <X size={20} />
            </button>
            <AnimatePresence mode="wait">
              <motion.div
                key={selectedItem.id}
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.25 }}
                className="flex flex-1 flex-col overflow-y-auto p-8 pb-4 lg:p-10 lg:pb-6"
              >
                <h2
                  className="font-bold leading-[1.05] tracking-tight"
                  style={{
                    fontSize: "clamp(1.75rem, 3.5vw, 2.75rem)",
                    color: "var(--orange-dark)",
                  }}
                >
                  {selectedItem.title}
                </h2>

                {selectedItem.details ? (
                  <>
                    <p className="mt-6 text-sm leading-relaxed text-stone-700 lg:text-base">
                      {selectedItem.details.description}
                    </p>

                    {selectedItem.details.sections?.map((section, i) => (
                      <div key={i} className="mt-6 flex flex-col gap-2.5">
                        <h3
                          className="text-xs font-bold uppercase tracking-widest"
                          style={{ color: "var(--orange-dark)" }}
                        >
                          {section.heading}
                        </h3>
                        {section.bullets && (
                          <ul className="flex flex-col gap-2">
                            {section.bullets.map((bullet, j) => (
                              <li key={j} className="flex items-start gap-2.5 text-sm text-stone-700">
                                <span
                                  className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full"
                                  style={{ background: "var(--orange)" }}
                                />
                                <span>{bullet}</span>
                              </li>
                            ))}
                          </ul>
                        )}
                        {section.body && (
                          <p className="text-sm leading-relaxed text-stone-700">{section.body}</p>
                        )}
                      </div>
                    ))}
                  </>
                ) : (
                  <p className="mt-6 text-sm leading-relaxed text-stone-700">{selectedItem.desc}</p>
                )}
              </motion.div>
            </AnimatePresence>

            <div className="flex shrink-0 flex-row flex-nowrap gap-2 px-8 pb-8 pt-2 sm:gap-3 lg:px-10 lg:pb-10">
              {actionLinks ? (
                actionLinks.map((actionLink) => (
                  <a
                    key={`${selectedItem.title}-${actionLink.label}`}
                    href={actionLink.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={drawerCtaClassName}
                  >
                    {actionLink.label}
                  </a>
                ))
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => onRegister(selectedItem.title)}
                    className={drawerCtaClassName}
                  >
                    Register
                  </button>
                  <button
                    type="button"
                    onClick={() => onVolunteer(selectedItem.title)}
                    className={drawerCtaClassName}
                  >
                    Volunteer
                  </button>
                </>
              )}
            </div>
          </div>
          </motion.div>
        </div>
      </motion.div>
      </div>
    </div>
  );
}

export interface InteractiveBentoGalleryProps {
  mediaItems: MediaItemType[];
  title: string;
  description: string;
}

export function InteractiveBentoGallery({
  mediaItems,
  title,
  description,
}: InteractiveBentoGalleryProps) {
  const [selectedItem, setSelectedItem] = useState<MediaItemType | null>(null);
  const [mounted, setMounted] = useState(false);
  const [isJoinModalOpen, setIsJoinModalOpen] = useState(false);
  const [joinAction, setJoinAction] = useState<string | null>(null);
  const [contactMessage, setContactMessage] = useState<string | null>(null);
  const hasOpenedJoinModalRef = useRef(false);
  hasOpenedJoinModalRef.current ||= isJoinModalOpen;
  const scrollYRef = useRef(0);
  const hashRef = useRef("");

  useEffect(() => {
    setMounted(true);
  }, []);

  const rememberViewport = useCallback(() => {
    scrollYRef.current = window.scrollY;
    hashRef.current = window.location.hash;
  }, []);

  const openItem = useCallback(
    (item: MediaItemType) => {
      setSelectedItem((current) => {
        if (!current) rememberViewport();
        return item;
      });
    },
    [rememberViewport],
  );

  const closeModal = useCallback((options: { restoreScroll?: boolean } = {}) => {
    const { restoreScroll = true } = options;
    const y = scrollYRef.current;
    const hash = hashRef.current;
    setSelectedItem(null);
    history.replaceState(null, "", `${window.location.pathname}${window.location.search}${hash}`);
    if (restoreScroll) {
      requestAnimationFrame(() => {
        window.scrollTo({ top: y, left: 0, behavior: "instant" });
      });
    }
  }, []);

  useEffect(() => {
    const openFromHash = () => {
      const hash = window.location.hash;
      const match = mediaItems.find((item) => item.href === hash);
      if (match) openItem(match);
    };
    openFromHash();
    window.addEventListener("hashchange", openFromHash);
    return () => window.removeEventListener("hashchange", openFromHash);
  }, [mediaItems, openItem]);

  useEffect(() => {
    const handler = (e: Event) => {
      const { href } = (e as CustomEvent<{ href: string }>).detail;
      const match = mediaItems.find((item) => item.href === href);
      if (match) openItem(match);
    };
    window.addEventListener("openProgram", handler);
    return () => window.removeEventListener("openProgram", handler);
  }, [mediaItems, openItem]);

  useEffect(() => {
    if (!selectedItem) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [selectedItem]);

  useEffect(() => {
    window.dispatchEvent(new CustomEvent("bentoGalleryOpen", { detail: { open: !!selectedItem } }));
  }, [selectedItem]);

  useEffect(() => {
    if (!selectedItem) return;
    const handleNavClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest('[role="dialog"]')) return;
      const anchor = target.closest("a[href^='#'], a[href^='/#']") as HTMLAnchorElement | null;
      const navbarButton = target.closest("header button") as HTMLButtonElement | null;
      if (!anchor && !navbarButton) return;
      document.body.style.overflow = "";
      closeModal({ restoreScroll: false });
    };
    document.addEventListener("click", handleNavClick, true);
    return () => document.removeEventListener("click", handleNavClick, true);
  }, [selectedItem, closeModal]);

  const openRegister = useCallback((programTitle: string) => {
    setJoinAction("Contact");
    setContactMessage(`I would like to register for ${programTitle}.`);
    setIsJoinModalOpen(true);
  }, []);

  const openVolunteer = useCallback((programTitle: string) => {
    const volunteerFormUrl = programActionLinks[programTitle]?.find(
      (actionLink) => actionLink.label === "Volunteer",
    )?.href;

    if (volunteerFormUrl) {
      window.open(volunteerFormUrl, "_blank", "noopener,noreferrer");
      return;
    }

    setJoinAction("Volunteer");
    setContactMessage(null);
    setIsJoinModalOpen(true);
  }, []);

  return (
    <div className="mx-auto w-full max-w-7xl">
      <div className="mb-8 text-center sm:mb-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <SectionLogoHeading
            id="featured-programs-heading"
            className="text-(--orange-light)"
          >
            {title}
          </SectionLogoHeading>
        </motion.div>
        <motion.div
          className="section-lead mx-auto"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
        >
          {description}
        </motion.div>
      </div>

      <div
        className={`programs-bento-frame${selectedItem ? " invisible pointer-events-none" : ""}`}
        aria-hidden={!!selectedItem}
      >
        <motion.div
          className="programs-bento-grid grid w-full grid-cols-1 gap-4 sm:grid-cols-4 sm:grid-rows-5 sm:gap-5 lg:gap-6"
          initial="hidden"
          animate="visible"
          variants={{
            hidden: { opacity: 0 },
            visible: {
              opacity: 1,
              transition: { staggerChildren: 0.08 },
            },
          }}
        >
          {mediaItems.map((item, index) => (
            <motion.div
              key={item.id}
              role="button"
              tabIndex={0}
              layoutId={`media-${item.id}`}
              className={`programs-bento-tile programs-bento-tile--${item.area} focus-ring-light block w-full cursor-pointer overflow-hidden p-0 text-left`}
              onClick={() => openItem(item)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  openItem(item);
                }
              }}
              variants={{
                hidden: { opacity: 0 },
                visible: {
                  opacity: 1,
                  transition: {
                    duration: 0.35,
                    delay: index * 0.06,
                  },
                },
              }}
            >
              <MediaItem
                item={item}
                className="pointer-events-none absolute inset-0 h-full w-full"
              />
              <div className="pointer-events-none absolute inset-0 flex flex-col justify-end p-4 sm:p-5 md:p-6">
                <div className="absolute inset-0 bg-linear-to-t from-black/85 via-black/35 to-transparent" />
                <h3 className="relative line-clamp-2 text-lg font-semibold text-white sm:text-xl md:text-2xl">
                  {item.title}
                </h3>
                <div className="relative mt-1.5 line-clamp-2 text-sm text-white/85 sm:text-base">
                  {item.desc}
                </div>
              </div>
            </motion.div>
          ))}
        </motion.div>
      </div>

      {mounted &&
        selectedItem &&
        createPortal(
          <GalleryModal
            selectedItem={selectedItem}
            isOpen
            onClose={closeModal}
            setSelectedItem={setSelectedItem}
            mediaItems={mediaItems}
            onRegister={openRegister}
            onVolunteer={openVolunteer}
          />,
          document.body,
        )}

      {hasOpenedJoinModalRef.current && (
        <JoinCommunityModal
          isOpen={isJoinModalOpen}
          onClose={() => setIsJoinModalOpen(false)}
          initialAction={joinAction}
          initialContactMessage={contactMessage}
        />
      )}
    </div>
  );
}
