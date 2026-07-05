"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

const DEFAULT_MAX_REM = 1.5;
const DEFAULT_MAX_SM_REM = 1.875;
const DEFAULT_MIN_REM = 1.125;

type AutoFitCardTitleProps = {
  children: React.ReactNode;
  className?: string;
  maxFontSizeRem?: number;
  maxFontSizeSmRem?: number;
  minFontSizeRem?: number;
};

export function AutoFitCardTitle({
  children,
  className,
  maxFontSizeRem = DEFAULT_MAX_REM,
  maxFontSizeSmRem = DEFAULT_MAX_SM_REM,
  minFontSizeRem = DEFAULT_MIN_REM,
}: AutoFitCardTitleProps) {
  const ref = useRef<HTMLHeadingElement>(null);
  const [allowWrap, setAllowWrap] = useState(false);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;

    const fit = () => {
      const rootPx = parseFloat(getComputedStyle(document.documentElement).fontSize);
      const maxRem = window.matchMedia("(min-width: 640px)").matches
        ? maxFontSizeSmRem
        : maxFontSizeRem;
      const maxPx = maxRem * rootPx;
      const minPx = minFontSizeRem * rootPx;

      el.style.whiteSpace = "nowrap";
      setAllowWrap(false);

      let sizePx = maxPx;
      el.style.fontSize = `${sizePx}px`;

      while (sizePx > minPx && el.scrollWidth > el.clientWidth) {
        sizePx -= 1;
        el.style.fontSize = `${sizePx}px`;
      }

      if (el.scrollWidth > el.clientWidth) {
        el.style.fontSize = `${minPx}px`;
        el.style.whiteSpace = "normal";
        setAllowWrap(true);
      }
    };

    fit();

    const observer = new ResizeObserver(fit);
    observer.observe(el);
    if (el.parentElement) observer.observe(el.parentElement);

    window.addEventListener("resize", fit);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", fit);
    };
  }, [children, maxFontSizeRem, maxFontSizeSmRem, minFontSizeRem]);

  return (
    <h3
      ref={ref}
      className={cn(
        "mt-4 w-full font-bold leading-tight",
        allowWrap ? "text-balance" : "whitespace-nowrap",
        className,
      )}
    >
      {children}
    </h3>
  );
}
