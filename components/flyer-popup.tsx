"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import type { PopupCmsData } from "@/lib/popup-cms/types";
import { isPopupReady, normalizeFooterColor } from "@/lib/popup-cms/helpers";
import {
  dismissPopupForSession,
  isPopupDismissedThisSession,
} from "@/lib/popup-cms/session";

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

interface FlyerPopupProps {
  popup: PopupCmsData;
}

export function FlyerPopup({ popup }: FlyerPopupProps) {
  const [open, setOpen] = useState(false);
  const [armed, setArmed] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  const ready = isPopupReady(popup);
  const ratio = popup.imageRatio > 0 ? popup.imageRatio : 9 / 16;
  const buttonLabel = popup.buttonLabel.trim();
  const buttonHref = popup.buttonHref.trim();

  useEffect(() => {
    if (!ready) return;
    if (isPopupDismissedThisSession(popup)) return;

    const target = document.getElementById("about");
    if (!target) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry?.isIntersecting && entry.intersectionRatio >= 0.25) {
          setArmed(true);
          observer.disconnect();
        }
      },
      { threshold: [0, 0.25, 0.5] },
    );

    observer.observe(target);
    return () => observer.disconnect();
  }, [popup, ready]);

  useEffect(() => {
    if (!armed || !ready) return;
    if (isPopupDismissedThisSession(popup)) return;
    setOpen(true);
  }, [armed, popup, ready]);

  const dismiss = useCallback(() => {
    dismissPopupForSession(popup);
    setOpen(false);
  }, [popup]);

  useEffect(() => {
    if (!open) return;

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") dismiss();
    };
    window.addEventListener("keydown", onKeyDown);
    closeRef.current?.focus();

    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open, dismiss]);

  if (!ready || !open) return null;

  const external = buttonHref ? isExternalHref(buttonHref) : false;
  const footerColor = normalizeFooterColor(popup.footerColor);

  return (
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
        aria-label="Event flyer"
      >
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
          style={{ aspectRatio: ratio }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={popup.imageUrl}
            alt=""
            className="flyer-popup__image"
          />
        </div>

        {buttonLabel && buttonHref ? (
          <div className="flyer-popup__footer" style={{ backgroundColor: footerColor }}>
            <a
              href={buttonHref}
              className="hero-cta-btn inline-flex min-h-11 w-full items-center justify-center px-4 text-sm font-semibold text-black"
              {...(external
                ? { target: "_blank", rel: "noopener noreferrer" }
                : {})}
              onClick={() => dismissPopupForSession(popup)}
            >
              {buttonLabel}
            </a>
          </div>
        ) : buttonLabel ? (
          <div className="flyer-popup__footer" style={{ backgroundColor: footerColor }}>
            <span className="block text-center text-sm text-(--ink)/60">
              {buttonLabel}
            </span>
          </div>
        ) : null}
      </div>
    </div>
  );
}
