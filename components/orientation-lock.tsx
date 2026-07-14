"use client";

import { useEffect, useSyncExternalStore } from "react";

/** Phone landscape: wider than tall, and short side ≤ 550px. */
function isPhoneLandscape() {
  if (typeof window === "undefined") return false;
  const w = window.innerWidth;
  const h = window.innerHeight;
  return w > h && Math.min(w, h) <= 550;
}

function subscribe(onStoreChange: () => void) {
  const onOrientation = () => {
    // iOS updates innerWidth/Height after orientationchange settles
    onStoreChange();
    window.setTimeout(onStoreChange, 50);
    window.setTimeout(onStoreChange, 250);
  };

  window.addEventListener("resize", onStoreChange);
  window.addEventListener("orientationchange", onOrientation);
  const mq = window.matchMedia("(orientation: landscape)");
  mq.addEventListener("change", onStoreChange);
  return () => {
    window.removeEventListener("resize", onStoreChange);
    window.removeEventListener("orientationchange", onOrientation);
    mq.removeEventListener("change", onStoreChange);
  };
}

export function OrientationLock() {
  const locked = useSyncExternalStore(subscribe, isPhoneLandscape, () => false);

  useEffect(() => {
    document.documentElement.toggleAttribute("data-orientation-lock", locked);
    return () => {
      document.documentElement.removeAttribute("data-orientation-lock");
    };
  }, [locked]);

  if (!locked) return null;

  return (
    <div
      className="orientation-lock orientation-lock--active"
      role="dialog"
      aria-modal="true"
      aria-labelledby="orientation-lock-title"
      aria-describedby="orientation-lock-desc"
    >
      <div className="orientation-lock__graphic" aria-hidden="true">
        <div className="orientation-lock__spin">
          <div className="orientation-lock__phone">
            <span className="orientation-lock__home" />
          </div>
        </div>
      </div>
      <p id="orientation-lock-title" className="orientation-lock__title">
        Please rotate your device
      </p>
      <p id="orientation-lock-desc" className="orientation-lock__desc">
        This site is best viewed in portrait mode.
      </p>
    </div>
  );
}
