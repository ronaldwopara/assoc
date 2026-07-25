"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Thin bar showing how far down the page the user has scrolled, sitting at
 * the seam between the safe-area strip and the header so it reads as part
 * of the chrome rather than floating content. Driven via transform (not
 * width) and rAF-throttled so it doesn't add scroll-jank.
 *
 * Hidden while the Featured Programs "Learn More" overlay is open — that
 * view locks body scroll and is its own page-like surface.
 */
export function ScrollProgress() {
  const barRef = useRef<HTMLDivElement>(null);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    const onGalleryOpen = (event: Event) => {
      const open = Boolean((event as CustomEvent<{ open?: boolean }>).detail?.open);
      setHidden(open);
    };
    window.addEventListener("bentoGalleryOpen", onGalleryOpen);
    return () => window.removeEventListener("bentoGalleryOpen", onGalleryOpen);
  }, []);

  useEffect(() => {
    if (hidden) return;

    let raf = 0;

    const update = () => {
      raf = 0;
      const doc = document.documentElement;
      const scrollable = doc.scrollHeight - doc.clientHeight;
      const progress = scrollable > 0 ? window.scrollY / scrollable : 0;
      const bar = barRef.current;
      if (bar) bar.style.transform = `scaleX(${Math.min(1, Math.max(0, progress))})`;
    };

    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };

    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [hidden]);

  if (hidden) return null;

  return (
    <div className="scroll-progress" aria-hidden="true">
      <div ref={barRef} className="scroll-progress__bar" />
    </div>
  );
}
