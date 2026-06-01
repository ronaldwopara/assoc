"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import type { MediaItemType } from "@/lib/featured-programs-data";

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

  if (!isOpen) return null;

  const currentIndex = mediaItems.findIndex((item) => item.id === selectedItem.id);
  const prevItem = mediaItems[currentIndex - 1] ?? null;
  const nextItem = mediaItems[currentIndex + 1] ?? null;

  return (
    <div
      className="fixed inset-0 z-[100] flex flex-col"
      style={{ backgroundImage: "url(/navbar.png)", backgroundRepeat: "repeat" }}
      role="dialog"
      aria-modal="true"
      aria-label={selectedItem.title}
    >
      {/* Contained card with margins on desktop */}
      <motion.div
        initial={{ scale: 0.97, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.97, opacity: 0 }}
        transition={{ type: "spring", stiffness: 400, damping: 30 }}
        className="relative flex min-h-0 flex-1 flex-col overflow-hidden sm:m-4 sm:rounded-2xl md:m-8"
      >
        {/* Full-bleed media inside the card */}
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

        {/* Gradient overlay — heavier at bottom like hero */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/35 to-black/25" />

        {/* X close button */}
        <motion.button
          type="button"
          className="focus-ring-light absolute left-4 top-4 z-20 text-white"
          onClick={onClose}
          aria-label="Close"
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
        >
          <X size={26} />
        </motion.button>

        {/* Hero-style text — left-aligned, vertically centered */}
        <AnimatePresence mode="wait">
          <motion.div
            key={selectedItem.id}
            className="absolute inset-0 z-10 flex flex-col items-start justify-center px-6 pb-28 text-left text-white sm:px-12 lg:px-16"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.3, delay: 0.1 }}
          >
            <div className="max-w-2xl">
              <h2 className="text-[clamp(1.75rem,4vw,3.25rem)] font-bold uppercase leading-[1.1] tracking-wide drop-shadow-[0_1px_8px_rgba(0,0,0,0.45)]">
                {selectedItem.title}
              </h2>
              <p className="mt-4 max-w-[38rem] text-base font-normal leading-relaxed text-white/90 sm:text-lg">
                {selectedItem.desc}
              </p>
            </div>
          </motion.div>
        </AnimatePresence>
      </motion.div>

      {/* Draggable thumbnail dock */}
      <motion.div
        drag
        dragMomentum={false}
        dragElastic={0.1}
        animate={{ x: dockPosition.x, y: dockPosition.y }}
        onDragEnd={(_, info) => {
          setDockPosition((prev) => ({
            x: prev.x + info.offset.x,
            y: prev.y + info.offset.y,
          }));
        }}
        className="fixed bottom-6 left-1/2 z-[101] -translate-x-1/2 touch-none"
      >
        <motion.div className="cursor-grab rounded-xl border border-white/[0.12] shadow-lg active:cursor-grabbing" style={{ background: "oklch(0.22 0.02 50 / 0.88)", backdropFilter: "blur(24px)", WebkitBackdropFilter: "blur(24px)" }}>
          <div className="flex items-center gap-3 px-4 py-4">
            {/* Left arrow */}
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); if (prevItem) setSelectedItem(prevItem); }}
              disabled={!prevItem}
              aria-label="Previous"
              className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg text-white transition disabled:opacity-25 hover:bg-white/10"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M15 18l-6-6 6-6"/></svg>
            </button>

            <div className="flex items-center -space-x-4">
            {mediaItems.map((item, index) => (
              <motion.button
                key={item.id}
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedItem(item);
                }}
                style={{
                  zIndex:
                    selectedItem.id === item.id
                      ? 30
                      : mediaItems.length - index,
                }}
                className={`group relative h-20 w-20 flex-shrink-0 overflow-hidden rounded-xl sm:h-24 sm:w-24 ${
                  selectedItem.id === item.id
                    ? "shadow-lg ring-2 ring-[var(--orange)]"
                    : "hover:ring-2 hover:ring-white/40"
                }`}
                initial={{ rotate: index % 2 === 0 ? -15 : 15 }}
                animate={{
                  scale: selectedItem.id === item.id ? 1.2 : 1,
                  rotate:
                    selectedItem.id === item.id
                      ? 0
                      : index % 2 === 0
                        ? -15
                        : 15,
                  y: selectedItem.id === item.id ? -8 : 0,
                }}
                whileHover={{
                  scale: 1.25,
                  rotate: 0,
                  y: -8,
                  transition: { type: "spring", stiffness: 400, damping: 25 },
                }}
                aria-label={`View ${item.title}`}
              >
                <MediaItem item={item} className="h-full w-full" />
                <div className="absolute inset-0 bg-gradient-to-b from-transparent via-white/5 to-white/15" />
              </motion.button>
            ))}
            </div>

            {/* Right arrow */}
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); if (nextItem) setSelectedItem(nextItem); }}
              disabled={!nextItem}
              aria-label="Next"
              className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg text-white transition disabled:opacity-25 hover:bg-white/10"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M9 18l6-6-6-6"/></svg>
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
    if (!selectedItem) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
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
            onClose={() => setSelectedItem(null)}
            setSelectedItem={setSelectedItem}
            mediaItems={items}
          />
        ) : (
          <div className="programs-bento-frame">
            <motion.div
              className="programs-bento-grid grid w-full grid-cols-1 gap-4 sm:grid-cols-4 sm:grid-rows-4 sm:gap-5 lg:gap-6"
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
                    <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/35 to-transparent" />
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
