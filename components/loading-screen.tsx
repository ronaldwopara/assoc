"use client";

import Image from "next/image";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { motion } from "framer-motion";

const MAX_WAIT = 6000;
const BAR_DURATION = 1500; // ms — must match loading-progress animation in globals.css

const LOADING_PHRASES = [
  "Loading...",
  "Almost there...",
  "Gathering the community...",
  "Setting the stage...",
  "Warming things up...",
  "Just a moment...",
  "Bringing it all together...",
];

type Phase = "loading" | "flying" | "closing" | "done";

interface FlyTarget {
  x: number;
  y: number;
  scale: number;
}

interface CollapseOrigin {
  x: string; // percentage/px for clip-path
  y: string;
}

export function LoadingScreen() {
  const [phase, setPhase]             = useState<Phase>("loading");
  const [phraseIndex, setPhraseIndex] = useState(0);
  const [visible, setVisible]         = useState(true);
  const [flyTarget, setFlyTarget]     = useState<FlyTarget>({ x: 0, y: 0, scale: 1 });
  const [collapse, setCollapse]       = useState<CollapseOrigin>({ x: "50%", y: "40px" });
  const logoRef                       = useRef<HTMLDivElement>(null);
  const dismissedRef                  = useRef(false);
  const mountTimeRef                  = useRef(Date.now());
  const [navbarTextureReady, setNavbarTextureReady] = useState(false);

  useEffect(() => {
    const img = document.createElement("img");
    img.fetchPriority = "high";
    img.src = "https://res.cloudinary.com/daldas2e7/image/upload/v1782010316/asosc/nav.png";
    if (img.complete) setNavbarTextureReady(true);
    else img.onload = () => setNavbarTextureReady(true);
  }, []);

  // Skip loading screen only if the hero is already ready in *this JS context*
  // (i.e. SPA navigation, not a page reload — window properties reset on reload).
  useLayoutEffect(() => {
    sessionStorage.removeItem("heroReady"); // clear any stale flag from old code
    const alreadyReady =
      (window as Window & { __heroReady?: boolean }).__heroReady;

    if (alreadyReady) {
      dismissedRef.current = true;
      document.body.style.overflow = "";
      setPhase("done");
    }
  }, []);

  const dismiss = useCallback(() => {
    // Guard: only ever run once. Without this, the 6s fallback timer fires
    // after the heroReady event already triggered dismiss, causing the loading
    // screen to reappear and play through its animation a second time.
    if (dismissedRef.current) return;
    dismissedRef.current = true;

    const elapsed   = Date.now() - mountTimeRef.current;
    // +300ms buffer: mountTimeRef is set at render time but the CSS animation
    // starts after the DOM commit, so naive elapsed is slightly too small.
    const remaining = Math.max(0, BAR_DURATION + 300 - elapsed);

    const doFly = () => {
      // Measure fresh at fly-out time so positions are accurate
      const navLogoEl = (window as Window & { __navLogoEl?: HTMLElement }).__navLogoEl;
      const logoEl    = logoRef.current;

      if (navLogoEl && logoEl) {
        const navRect  = navLogoEl.getBoundingClientRect();
        const logoRect = logoEl.getBoundingClientRect();

        const navCX  = navRect.left  + navRect.width  / 2;
        const navCY  = navRect.top   + navRect.height / 2;
        const logoCX = logoRect.left + logoRect.width  / 2;
        const logoCY = logoRect.top  + logoRect.height / 2;

        setFlyTarget({
          x:     navCX - logoCX,
          y:     navCY - logoCY,
          scale: navRect.height / logoRect.height,
        });

        setCollapse({ x: `${navCX}px`, y: `${navCY}px` });
        setPhase("flying");
      } else {
        setPhase("closing");
      }
    };

    setTimeout(doFly, remaining);
  }, []);

  useEffect(() => {
    // useLayoutEffect already handled the fast-reload case
    if (dismissedRef.current) return;

    document.body.style.overflow = "hidden";
    window.addEventListener("heroReady", dismiss, { once: true });
    const fallback = setTimeout(dismiss, MAX_WAIT);

    return () => {
      window.removeEventListener("heroReady", dismiss);
      clearTimeout(fallback);
      document.body.style.overflow = "";
    };
  }, [dismiss]);

  // Phrase cycling — only while loading
  useEffect(() => {
    if (phase !== "loading") return;
    const id = setInterval(() => {
      setVisible(false);
      setTimeout(() => {
        setPhraseIndex((i) => (i + 1) % LOADING_PHRASES.length);
        setVisible(true);
      }, 300);
    }, 1800);
    return () => clearInterval(id);
  }, [phase]);

  if (phase === "done") return null;

  const panelAnimate =
    phase === "closing"
      ? { clipPath: `circle(0px at ${collapse.x} ${collapse.y})` }
      : { clipPath: `circle(5000px at ${collapse.x} ${collapse.y})` };

  const panelTransition =
    phase === "closing"
      ? { delay: 0.05, type: "spring" as const, stiffness: 400, damping: 40 }
      : { duration: 0 };

  return (
    <motion.div
      className="loading-screen"
      style={{ pointerEvents: phase === "loading" || phase === "flying" ? "auto" : "none" }}
      animate={panelAnimate}
      transition={panelTransition}
      initial={{ clipPath: "circle(5000px at 50% 40px)" }}
      onAnimationComplete={() => {
        if (phase === "closing") {
          document.body.style.overflow = "";
          setPhase("done");
        }
      }}
    >
      <div className="loading-screen__bg" aria-hidden>
        <div
          className="loading-screen__bg-texture"
          data-ready={navbarTextureReady ? "true" : undefined}
        />
      </div>
      <div className="loading-screen__progress-bar" aria-hidden>
        <div className="loading-screen__progress-fill" />
      </div>

      <div className="loading-screen__center">
        {/* Logo — measured, then flown to the exact navbar logo position */}
        <motion.div
          ref={logoRef}
          animate={
            phase === "loading"
              ? { x: 0, y: 0, scale: 1 }
              : { x: flyTarget.x, y: flyTarget.y, scale: flyTarget.scale }
          }
          transition={{ type: "spring", stiffness: 300, damping: 32 }}
          style={{ transformOrigin: "center center" }}
          onAnimationComplete={() => {
            if (phase === "flying") setPhase("closing");
          }}
        >
          <Image
            src="https://res.cloudinary.com/daldas2e7/image/upload/v1782010314/asosc/logo.webp"
            alt="ASOSC"
            width={160}
            height={160}
            className="loading-screen__logo"
            priority
          />
        </motion.div>

        {/* Text stays in the DOM during "flying" so the flex layout doesn't
            reflow — a reflow would shift the logo's position after we measured
            it, making the y translation land in the wrong spot. */}
        <span
          className="loading-screen__loading-label"
          style={{
            opacity: phase === "loading" && visible ? 1 : 0,
            transition: "opacity 0.25s ease",
            pointerEvents: "none",
          }}
        >
          {LOADING_PHRASES[phraseIndex]}
        </span>
        <span
          className="loading-screen__org-name"
          style={{
            opacity: phase === "loading" ? 1 : 0,
            transition: "opacity 0.2s ease",
            pointerEvents: "none",
          }}
        >
          Africans Society of Strathcona County
        </span>
      </div>
    </motion.div>
  );
}
