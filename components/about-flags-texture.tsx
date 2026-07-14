"use client";

import { useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { AFRICAN_COUNTRY_CODES } from "@/lib/african-country-codes";
import { cn } from "@/lib/utils";

const SECOND_CARD_ID = "module-home-features-card_2";
const CONTENT_CLASS = "about-section-shell__content";

const FLAG_HEIGHT = 80;
const FLAG_WIDTH = 107;
const ROW_GAP = 3;
const ROW_HEIGHT = FLAG_HEIGHT + ROW_GAP;
const BASE_DURATION_S = 70;

function offsetTopWithin(root: HTMLElement, el: HTMLElement) {
  let top = 0;
  let node: HTMLElement | null = el;

  while (node && node !== root) {
    top += node.offsetTop;
    node = node.parentElement;
  }

  return top;
}

function shuffle<T>(items: readonly T[], seed: number): T[] {
  const arr = [...items];
  let s = seed;

  const random = () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };

  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }

  return arr;
}

function FlagRow({ rowIndex }: { rowIndex: number }) {
  const reverse = rowIndex % 2 === 1;
  const duration = BASE_DURATION_S + ((rowIndex % 3) - 1) * 5;
  const sequence = useMemo(
    () => shuffle(AFRICAN_COUNTRY_CODES, rowIndex * 7919 + 104729),
    [rowIndex],
  );
  const doubled = useMemo(() => [...sequence, ...sequence], [sequence]);

  return (
    <div className="about-flags-texture__row">
      <div
        className={
          reverse
            ? "about-flags-texture__track about-flags-texture__track--reverse"
            : "about-flags-texture__track"
        }
        style={{ animationDuration: `${duration}s` }}
      >
        {doubled.map((code, index) => (
          <img
            key={`${code}-${index}`}
            src={`/flags/4x3/${code}.svg`}
            alt=""
            className="about-flags-texture__flag"
            width={FLAG_WIDTH}
            height={FLAG_HEIGHT}
            draggable={false}
            loading="eager"
            decoding="async"
          />
        ))}
      </div>
    </div>
  );
}

function AboutFlagsTexture({ top, rowCount }: { top: number; rowCount: number }) {
  if (rowCount < 1) return null;

  return (
    <div
      className="about-flags-texture"
      style={{ top: `${top}px` }}
      aria-hidden="true"
    >
      {Array.from({ length: rowCount }, (_, index) => (
        <FlagRow key={index} rowIndex={index} />
      ))}
    </div>
  );
}

interface AboutSectionShellProps {
  id?: string;
  className?: string;
  "aria-labelledby"?: string;
  children: ReactNode;
}

/** Flags start where Mission meets Vision and tile down to the section end. */
export function AboutSectionShell({
  id,
  className,
  "aria-labelledby": labelledBy,
  children,
}: AboutSectionShellProps) {
  const sectionRef = useRef<HTMLElement>(null);
  const [meetTop, setMeetTop] = useState(0);
  const [rowCount, setRowCount] = useState(0);
  const [ready, setReady] = useState(false);

  useLayoutEffect(() => {
    const section = sectionRef.current;
    if (!section) return;

    let frame = 0;
    let attempts = 0;

    const measure = () => {
      const card2 = section.querySelector<HTMLElement>(`#${SECOND_CARD_ID}`);
      if (!card2) return false;

      /* Top of Vision card = where the two cards meet in the layout */
      const seamY = offsetTopWithin(section, card2);
      const textureHeight = section.offsetHeight - seamY;
      const rows = Math.floor((textureHeight + ROW_GAP) / ROW_HEIGHT);

      setMeetTop(Math.max(0, Math.round(seamY)));
      setRowCount(Math.max(1, rows));
      setReady(true);
      return true;
    };

    const scheduleMeasure = () => {
      if (measure()) return;
      if (attempts < 40) {
        attempts += 1;
        frame = window.requestAnimationFrame(scheduleMeasure);
      }
    };

    scheduleMeasure();

    const observer = new ResizeObserver(measure);
    observer.observe(section);

    const card2 = section.querySelector(`#${SECOND_CARD_ID}`);
    if (card2) observer.observe(card2);

    const content = section.querySelector(`.${CONTENT_CLASS}`);
    if (content) observer.observe(content);

    window.addEventListener("resize", measure);
    window.addEventListener("load", measure);

    return () => {
      window.cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener("resize", measure);
      window.removeEventListener("load", measure);
    };
  }, []);

  return (
    <section
      ref={sectionRef}
      id={id}
      className={cn(
        "about-section-shell section-shell bg-(--cream-light)",
        className,
      )}
      aria-labelledby={labelledBy}
    >
      {ready && <AboutFlagsTexture top={meetTop} rowCount={rowCount} />}
      <div className={CONTENT_CLASS}>{children}</div>
    </section>
  );
}
