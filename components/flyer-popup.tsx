"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { usePathname } from "next/navigation";
import { X } from "lucide-react";
import type { PopupCmsData } from "@/lib/popup-cms/types";
import { isPopupReady, normalizeFooterColor } from "@/lib/popup-cms/helpers";

function isExternalHref(href: string): boolean {
  try {
    const url = new URL(href, "https://asosc.ca");
    return url.protocol === "http:" || url.protocol === "https:"
      ? url.origin !== "https://asosc.ca"
      : false;
  } catch {
    return false;
  }
}

/** About is a tall sticky-card section — ratio-of-target can never hit 25% on phones. */
function aboutHasEnteredView(entry: IntersectionObserverEntry): boolean {
  if (!entry.isIntersecting) return false;
  const visiblePx = entry.intersectionRect.height;
  // Any meaningful slice of About in view (or ~20% of the viewport) is enough.
  return visiblePx >= 120 || entry.intersectionRatio >= 0.2;
}

interface FlyerPopupProps {
  popup: PopupCmsData;
}

export function FlyerPopup({ popup }: FlyerPopupProps) {
  const pathname = usePathname();
  const onHomepage = pathname === "/";
  const titleId = useId();
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const [armed, setArmed] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const scrollLockRef = useRef<{ y: number; body: string; html: string } | null>(
    null,
  );

  const ready = isPopupReady(popup);
  const ratio = popup.imageRatio > 0 ? popup.imageRatio : 9 / 16;
  const buttonLabel = popup.buttonLabel.trim();
  const buttonHref = popup.buttonHref.trim();

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!onHomepage) {
      setArmed(false);
      setOpen(false);
    }
  }, [onHomepage]);

  useEffect(() => {
    if (!onHomepage || !ready || dismissed) return;

    const target = document.getElementById("about");
    if (!target) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry && aboutHasEnteredView(entry)) {
          setArmed(true);
          observer.disconnect();
        }
      },
      // Dense thresholds so tall sections still report useful intersection slices.
      { threshold: [0, 0.01, 0.02, 0.05, 0.1, 0.15, 0.2, 0.25, 0.5, 1] },
    );

    observer.observe(target);
    return () => observer.disconnect();
  }, [popup, ready, dismissed, onHomepage]);

  useEffect(() => {
    if (!onHomepage || !armed || !ready || dismissed) return;
    setOpen(true);
  }, [armed, popup, ready, dismissed, onHomepage]);

  const dismiss = useCallback(() => {
    // In-memory only — a full homepage refresh should show the flyer again.
    setDismissed(true);
    setOpen(false);
  }, []);

  useEffect(() => {
    if (!open) return;

    const html = document.documentElement;
    const body = document.body;
    const y = window.scrollY;
    scrollLockRef.current = {
      y,
      body: body.style.cssText,
      html: html.style.overflow,
    };

    // iOS ignores overflow:hidden on body alone — pin the page in place.
    html.style.overflow = "hidden";
    body.style.position = "fixed";
    body.style.top = `-${y}px`;
    body.style.left = "0";
    body.style.right = "0";
    body.style.width = "100%";
    body.style.overflow = "hidden";

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") dismiss();
    };
    window.addEventListener("keydown", onKeyDown);
    // preventScroll avoids the "jump to bottom" focus scroll when the dialog
    // is portaled / late-painted relative to the document flow position.
    const focusFrame = window.requestAnimationFrame(() => {
      closeRef.current?.focus({ preventScroll: true });
    });

    return () => {
      window.cancelAnimationFrame(focusFrame);
      window.removeEventListener("keydown", onKeyDown);
      const locked = scrollLockRef.current;
      scrollLockRef.current = null;
      if (!locked) return;
      body.style.cssText = locked.body;
      html.style.overflow = locked.html;
      window.scrollTo(0, locked.y);
    };
  }, [open, dismiss]);

  if (!mounted || !onHomepage || !ready || !open) return null;

  const external = buttonHref ? isExternalHref(buttonHref) : false;
  const footerColor = normalizeFooterColor(popup.footerColor);

  return createPortal(
    <div className="flyer-popup" role="presentation">
      <button
        type="button"
        className="flyer-popup__backdrop"
        aria-label="Close popup"
        onClick={dismiss}
      />
      <div
        ref={dialogRef}
        className="flyer-popup__dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <h2 id={titleId} className="sr-only">
          Event flyer
        </h2>
        <button
          ref={closeRef}
          type="button"
          className="flyer-popup__close focus-ring-light"
          aria-label="Close"
          onClick={dismiss}
        >
          <X className="h-5 w-5" aria-hidden />
        </button>

        <div
          className="flyer-popup__image-wrap"
          style={{ aspectRatio: `${ratio}` }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={popup.imageUrl}
            alt=""
            className="flyer-popup__image"
            draggable={false}
          />
        </div>

        {buttonLabel && buttonHref ? (
          <div
            className="flyer-popup__footer"
            style={{ backgroundColor: footerColor }}
          >
            <a
              href={buttonHref}
              className="hero-cta-btn flyer-popup__cta inline-flex min-h-11 w-full items-center justify-center px-4 text-sm font-semibold text-black"
              {...(external
                ? { target: "_blank", rel: "noopener noreferrer" }
                : {})}
              onClick={dismiss}
            >
              {buttonLabel}
            </a>
          </div>
        ) : buttonLabel ? (
          <div
            className="flyer-popup__footer"
            style={{ backgroundColor: footerColor }}
          >
            <span className="block text-center text-sm text-(--ink)/60">
              {buttonLabel}
            </span>
          </div>
        ) : null}
      </div>
    </div>,
    document.body,
  );
}
