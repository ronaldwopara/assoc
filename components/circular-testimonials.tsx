"use client";

import {
  useEffect,
  useRef,
  useState,
  useMemo,
  useCallback,
  type CSSProperties,
} from "react";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { ContentBrow } from "@/components/content-brow";
import { MediaPlaceholder, useMediaLoaded } from "@/components/media-placeholder";
import { cn } from "@/lib/utils";

interface Testimonial {
  name: string;
  designation: string;
  src: string;
}

interface CircularTestimonialsProps {
  testimonials: Testimonial[];
  autoplay?: boolean;
  theme?: "light" | "dark";
}

function calculateGap(width: number) {
  return Math.round(Math.max(32, Math.min(52, width * 0.18)));
}

const contentVariants = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -20 },
};

function TestimonialPhoto({
  testimonial,
  index,
  style,
}: {
  testimonial: Testimonial;
  index: number;
  style: CSSProperties;
}) {
  const { loaded, markLoaded, imgRef } = useMediaLoaded();

  return (
    <div className="absolute inset-0" style={style} data-index={index}>
      <MediaPlaceholder
        loaded={loaded}
        tone="black"
        className="h-full w-full rounded-3xl shadow-[0_10px_30px_rgba(0,0,0,0.2)]"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          ref={imgRef}
          src={testimonial.src}
          alt={testimonial.name}
          className={cn(
            "absolute inset-0 h-full w-full rounded-3xl object-cover object-[center_20%] transition-opacity duration-300 ease-out",
            !loaded && "opacity-0",
          )}
          onLoad={markLoaded}
          onError={markLoaded}
        />
      </MediaPlaceholder>
    </div>
  );
}

export function CircularTestimonials({
  testimonials,
  autoplay = true,
  theme = "light",
}: CircularTestimonialsProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [containerWidth, setContainerWidth] = useState(1200);

  const imageContainerRef = useRef<HTMLDivElement>(null);
  const autoplayIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const testimonialsLength = useMemo(() => testimonials.length, [testimonials]);
  const activeTestimonial = useMemo(
    () => testimonials[activeIndex],
    [activeIndex, testimonials],
  );

  useEffect(() => {
    function handleResize() {
      if (imageContainerRef.current) {
        setContainerWidth(imageContainerRef.current.offsetWidth);
      }
    }
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const handleNext = useCallback(() => {
    setActiveIndex((prev) => (prev + 1) % testimonialsLength);
  }, [testimonialsLength]);

  const handlePrev = useCallback(() => {
    setActiveIndex((prev) => (prev - 1 + testimonialsLength) % testimonialsLength);
  }, [testimonialsLength]);

  const restartAutoplay = useCallback(() => {
    if (!autoplay) return;
    if (autoplayIntervalRef.current) clearInterval(autoplayIntervalRef.current);
    autoplayIntervalRef.current = setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % testimonialsLength);
    }, 5000);
  }, [autoplay, testimonialsLength]);

  const handleNextClick = useCallback(() => {
    handleNext();
    restartAutoplay();
  }, [handleNext, restartAutoplay]);

  const handlePrevClick = useCallback(() => {
    handlePrev();
    restartAutoplay();
  }, [handlePrev, restartAutoplay]);

  useEffect(() => {
    restartAutoplay();
    return () => {
      if (autoplayIntervalRef.current) clearInterval(autoplayIntervalRef.current);
    };
  }, [restartAutoplay]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") handlePrevClick();
      if (e.key === "ArrowRight") handleNextClick();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [handlePrevClick, handleNextClick]);

  function getImageStyle(index: number): CSSProperties {
    const gap = calculateGap(containerWidth);
    const maxStickUp = gap * 0.8;
    const isActive = index === activeIndex;
    const isLeft = (activeIndex - 1 + testimonialsLength) % testimonialsLength === index;
    const isRight = (activeIndex + 1) % testimonialsLength === index;

    if (isActive) {
      return {
        zIndex: 3,
        opacity: 1,
        pointerEvents: "auto",
        transform: "translateX(0px) translateY(0px) scale(1) rotateY(0deg)",
        transition: "all 0.8s cubic-bezier(.4,2,.3,1)",
      };
    }
    if (isLeft) {
      return {
        zIndex: 2,
        opacity: 1,
        pointerEvents: "auto",
        transform: `translateX(-${gap}px) translateY(-${maxStickUp}px) scale(0.85) rotateY(15deg)`,
        transition: "all 0.8s cubic-bezier(.4,2,.3,1)",
      };
    }
    if (isRight) {
      return {
        zIndex: 2,
        opacity: 1,
        pointerEvents: "auto",
        transform: `translateX(${gap}px) translateY(-${maxStickUp}px) scale(0.85) rotateY(-15deg)`,
        transition: "all 0.8s cubic-bezier(.4,2,.3,1)",
      };
    }
    return {
      zIndex: 1,
      opacity: 0,
      pointerEvents: "none",
      transition: "all 0.8s cubic-bezier(.4,2,.3,1)",
    };
  }

  return (
    <div className="w-full max-w-5xl p-8">
      <div className="grid items-center gap-12 md:grid-cols-2 md:gap-x-16 lg:gap-x-20">
        <div className="flex justify-center md:justify-end md:pr-2 lg:pr-6">
          <div
            ref={imageContainerRef}
            className="relative aspect-3/4 w-full max-w-[260px] sm:max-w-[280px]"
            style={{ perspective: "1000px" }}
          >
            {testimonials.map((testimonial, index) => (
              <TestimonialPhoto
                key={testimonial.src}
                testimonial={testimonial}
                index={index}
                style={getImageStyle(index)}
              />
            ))}
          </div>
        </div>

        <div className="flex flex-col items-center justify-center gap-10 px-2 text-center md:gap-12 md:px-6 lg:px-10">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeIndex}
              variants={contentVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              transition={{ duration: 0.3, ease: "easeInOut" }}
              className="space-y-5"
            >
              <h3
                className={
                  theme === "dark"
                    ? "text-2xl font-bold leading-tight text-(--cream-light) sm:text-3xl lg:text-4xl"
                    : "text-2xl font-bold leading-tight text-(--orange) sm:text-3xl lg:text-4xl"
                }
              >
                {activeTestimonial.designation}
              </h3>
              <ContentBrow theme={theme === "dark" ? "dark" : "light"}>
                {activeTestimonial.name}
              </ContentBrow>
            </motion.div>
          </AnimatePresence>

          <div className="flex justify-center gap-6 pt-2">
            <button
              type="button"
              onClick={handlePrevClick}
              aria-label="Previous board member"
              className="focus-ring-light flex h-11 w-11 cursor-pointer items-center justify-center rounded-full border-none bg-(--orange) text-(--cream-light) transition-colors duration-300 hover:bg-(--hero-cta) hover:text-black"
            >
              <ArrowLeft size={22} />
            </button>
            <button
              type="button"
              onClick={handleNextClick}
              aria-label="Next board member"
              className="focus-ring-light flex h-11 w-11 cursor-pointer items-center justify-center rounded-full border-none bg-(--orange) text-(--cream-light) transition-colors duration-300 hover:bg-(--hero-cta) hover:text-black"
            >
              <ArrowRight size={22} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
