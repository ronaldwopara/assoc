"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import type { MediaItemType } from "@/lib/featured-programs-data";

const ctaClassName =
  "hero-cta-btn focus-ring-light inline-flex min-h-14 cursor-pointer items-center justify-center px-10 py-4 text-base font-semibold tracking-wide text-black transition duration-200 ease-out";
function MediaItem({
  item,
  className,
  onClick,
}: {
  item: MediaItemType;
  className?: string;
  onClick?: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isInView, setIsInView] = useState(false);
  const [isBuffering, setIsBuffering] = useState(true);

  useEffect(() => {
    const options = {
      root: null,
      rootMargin: "50px",
      threshold: 0.1,
    };

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        setIsInView(entry.isIntersecting);
      });
    }, options);

    const video = videoRef.current;
    if (video) observer.observe(video);

    return () => {
      if (video) observer.unobserve(video);
    };
  }, []);

  useEffect(() => {
    let mounted = true;

    const handleVideoPlay = async () => {
      if (!videoRef.current || !isInView || !mounted) return;

      try {
        if (videoRef.current.readyState >= 3) {
          setIsBuffering(false);
          await videoRef.current.play();
        } else {
          setIsBuffering(true);
          await new Promise<void>((resolve) => {
            if (videoRef.current) {
              videoRef.current.oncanplay = () => resolve();
            }
          });
          if (mounted) {
            setIsBuffering(false);
            await videoRef.current.play();
          }
        }
      } catch {
        setIsBuffering(false);
      }
    };

    if (isInView) {
      handleVideoPlay();
    } else if (videoRef.current) {
      videoRef.current.pause();
    }

    return () => {
      mounted = false;
      if (videoRef.current) {
        videoRef.current.pause();
      }
    };
  }, [isInView]);

  if (item.type === "video") {
    return (
      <div className={`${className ?? ""} relative overflow-hidden`}>
        <video
          ref={videoRef}
          className="h-full w-full object-cover"
          onClick={onClick}
          playsInline
          muted
          loop
          preload="auto"
          style={{
            opacity: isBuffering ? 0.8 : 1,
            transition: "opacity 0.2s",
            transform: "translateZ(0)",
          }}
        >
          <source src={item.url} type="video/mp4" />
        </video>
        {isBuffering && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/10">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-white/30 border-t-white" />
          </div>
        )}
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
}: {
  selectedItem: MediaItemType;
  isOpen: boolean;
  onClose: () => void;
  setSelectedItem: (item: MediaItemType | null) => void;
  mediaItems: MediaItemType[];
}) {
  const [dockPosition, setDockPosition] = useState({ x: 0, y: 0 });
  const [drawerOpen, setDrawerOpen] = useState(false);
  const drawerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!drawerOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (drawerRef.current && !drawerRef.current.contains(e.target as Node)) {
        setDrawerOpen(false);
      }
    };
    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
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

  return (
    <div
      className="fixed inset-0 z-40 flex flex-col overflow-x-hidden bg-(--terracotta)"
      role="dialog"
      aria-modal="true"
      aria-label={selectedItem.title}
    >
      <div className="relative z-10 flex min-h-0 flex-1 flex-col overflow-x-hidden pt-(--navbar-height)">
      {/* Card */}
      <motion.div
        initial={{ scale: 0.97, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.97, opacity: 0 }}
        transition={{ type: "spring", stiffness: 400, damping: 30 }}
        className="relative mx-auto flex min-h-0 w-full flex-1 flex-col overflow-hidden rounded-t-2xl sm:my-4 sm:max-w-5xl sm:rounded-2xl md:my-8 lg:max-w-6xl"
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
        <div className="absolute inset-0 bg-linear-to-t from-black/80 via-black/35 to-black/25" />

        {/* Close button — top left */}
        <motion.button
          type="button"
          className="focus-ring-light absolute left-4 top-4 z-20 text-(--gold) transition-colors duration-150 hover:text-(--gold-dark)"
          onClick={onClose}
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
            className={`absolute inset-0 z-10 flex flex-col items-start pl-6 text-left text-white sm:pl-12 lg:pl-16 ${
              drawerOpen
                ? "justify-end pb-32 pr-6 sm:pr-[calc(22rem+3.5rem+1.5rem)] lg:pb-36 lg:pr-[calc(28rem+3.5rem+1.5rem)]"
                : "justify-center pb-28 pr-20 sm:pr-24"
            }`}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.3, delay: 0.1 }}
          >
            <div className={`w-full ${drawerOpen ? "max-w-none" : "max-w-2xl"}`}>
              <h2 className="wrap-break-word text-[clamp(1.75rem,4vw,3.25rem)] font-bold uppercase leading-[1.1] tracking-wide drop-shadow-[0_1px_8px_rgba(0,0,0,0.45)]">
                {selectedItem.title}
              </h2>
              <p className="mt-4 max-w-152 text-base font-normal leading-relaxed text-white/90 sm:text-lg">
                {selectedItem.desc}
              </p>
              <button
                type="button"
                onClick={() => setDrawerOpen((v) => !v)}
                className={`${ctaClassName} mt-6`}
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
          className="pointer-events-none absolute inset-y-0 right-0 z-30 w-full sm:w-[calc(22rem+3.5rem)] lg:w-[calc(28rem+3.5rem)]"
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
          <div className="flex flex-1 flex-col overflow-hidden" style={{ background: "#fff7ed" }}>
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

            <div className="shrink-0 px-8 pb-28 pt-2 lg:px-10 lg:pb-32">
              <button
                type="button"
                onClick={() => {
                  document.body.style.overflow = "";
                  onClose();
                  requestAnimationFrame(() => {
                    document.getElementById("gallery")?.scrollIntoView({ behavior: "smooth" });
                  });
                }}
                className={`${ctaClassName} self-start`}
              >
                Explore Our Gallery
              </button>
            </div>
          </div>
          </motion.div>
        </div>
      </motion.div>
      </div>

      {/* Draggable thumbnail dock — stays centered at viewport bottom */}
      <motion.div
        drag
        dragMomentum={false}
        dragElastic={0.1}
        animate={{
          x: dockPosition.x,
          y: dockPosition.y,
        }}
        transition={{ type: "spring", stiffness: 300, damping: 35 }}
        onDragEnd={(_, info) => {
          setDockPosition((prev) => ({
            x: prev.x + info.offset.x,
            y: prev.y + info.offset.y,
          }));
        }}
        className="fixed bottom-6 left-1/2 z-101 -translate-x-1/2 touch-none"
      >
        <motion.div
          className="relative origin-bottom scale-[0.88] cursor-grab overflow-visible active:cursor-grabbing sm:scale-[0.92]"
        >
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 rounded-xl border border-white/12 shadow-lg"
            style={{
              background: "oklch(0.22 0.02 50 / 0.88)",
              backdropFilter: "blur(24px)",
              WebkitBackdropFilter: "blur(24px)",
            }}
          />
          <div className="relative flex max-w-[calc(100vw-2rem)] items-center gap-1.5 px-3 py-5 sm:max-w-none sm:gap-2 sm:px-4 sm:py-6">
            {/* Left arrow */}
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); if (prevItem) setSelectedItem(prevItem); }}
              disabled={!prevItem}
              aria-label="Previous"
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-white transition disabled:opacity-25 hover:bg-white/10 sm:h-8 sm:w-8"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M15 18l-6-6 6-6"/></svg>
            </button>

            <div className="flex items-center overflow-visible px-0.5 -space-x-3">
              {mediaItems.map((item, index) => (
                <motion.button
                  key={item.id}
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedItem(item);
                  }}
                  style={{
                    zIndex: selectedItem.id === item.id ? 30 : mediaItems.length - index,
                  }}
                  className={`group relative h-14 w-14 shrink-0 overflow-hidden rounded-lg border-2 sm:h-[5.25rem] sm:w-[5.25rem] ${
                    selectedItem.id === item.id
                      ? "border-(--orange) shadow-lg"
                      : "border-transparent hover:border-white/35"
                  }`}
                  initial={{ rotate: index % 2 === 0 ? -15 : 15 }}
                  animate={{
                    rotate: selectedItem.id === item.id ? 0 : index % 2 === 0 ? -15 : 15,
                  }}
                  whileHover={{
                    rotate: 0,
                    transition: { type: "spring", stiffness: 400, damping: 25 },
                  }}
                  aria-label={`View ${item.title}`}
                >
                  <MediaItem item={item} className="h-full w-full" />
                  <div className="absolute inset-0 bg-linear-to-b from-transparent via-white/5 to-white/15" />
                </motion.button>
              ))}
            </div>

            {/* Right arrow */}
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); if (nextItem) setSelectedItem(nextItem); }}
              disabled={!nextItem}
              aria-label="Next"
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-white transition disabled:opacity-25 hover:bg-white/10 sm:h-8 sm:w-8"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M9 18l6-6-6-6"/></svg>
            </button>
          </div>
        </motion.div>
      </motion.div>
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
  const [items] = useState(mediaItems);

  useEffect(() => {
    const openFromHash = () => {
      const hash = window.location.hash;
      const match = mediaItems.find((item) => item.href === hash);
      if (match) setSelectedItem(match);
    };
    openFromHash();
    window.addEventListener("hashchange", openFromHash);
    return () => window.removeEventListener("hashchange", openFromHash);
  }, [mediaItems]);

  useEffect(() => {
    const handler = (e: Event) => {
      const { href } = (e as CustomEvent<{ href: string }>).detail;
      const match = mediaItems.find((item) => item.href === href);
      if (match) setSelectedItem(match);
    };
    window.addEventListener("openProgram", handler);
    return () => window.removeEventListener("openProgram", handler);
  }, [mediaItems]);

  const closeModal = () => {
    setSelectedItem(null);
    history.replaceState(null, "", window.location.pathname + window.location.search);
  };

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
      const anchor = (e.target as HTMLElement).closest("a[href^='#']") as HTMLAnchorElement | null;
      if (!anchor || anchor.closest('[role="dialog"]')) return;
      document.body.style.overflow = "";
      closeModal();
    };
    document.addEventListener("click", handleNavClick, true);
    return () => document.removeEventListener("click", handleNavClick, true);
  }, [selectedItem]);

  return (
    <div className="mx-auto w-full max-w-7xl">
      <div className="mb-8 text-center sm:mb-10">
        <motion.h2
          id="featured-programs-heading"
          className="section-heading"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          {title}
        </motion.h2>
        <motion.div
          className="section-lead mx-auto"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
        >
          {description}
        </motion.div>
      </div>

      <AnimatePresence mode="wait">
        {selectedItem ? (
          <GalleryModal
            selectedItem={selectedItem}
            isOpen
            onClose={closeModal}
            setSelectedItem={setSelectedItem}
            mediaItems={items}
          />
        ) : (
          <div className="programs-bento-frame">
            <motion.div
              className="programs-bento-grid grid w-full grid-cols-1 gap-4 sm:grid-cols-4 sm:grid-rows-5 sm:gap-5 lg:gap-6"
              initial="hidden"
              animate="visible"
              exit="hidden"
              variants={{
                hidden: { opacity: 0 },
                visible: {
                  opacity: 1,
                  transition: { staggerChildren: 0.08 },
                },
              }}
            >
              {items.map((item, index) => (
                <motion.button
                  key={item.id}
                  type="button"
                  layoutId={`media-${item.id}`}
                  className={`programs-bento-tile programs-bento-tile--${item.area} focus-ring-light block w-full border-0 p-0 text-left`}
                  onClick={() => setSelectedItem(item)}
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
                    className="absolute inset-0 h-full w-full"
                  />
                  <div className="absolute inset-0 flex flex-col justify-end p-4 sm:p-5 md:p-6">
                    <div className="absolute inset-0 bg-linear-to-t from-black/85 via-black/35 to-transparent" />
                    <h3 className="relative line-clamp-2 text-lg font-semibold text-white sm:text-xl md:text-2xl">
                      {item.title}
                    </h3>
                    <div className="relative mt-1.5 line-clamp-2 text-sm text-white/85 sm:text-base">
                      {item.desc}
                    </div>
                  </div>
                </motion.button>
              ))}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
