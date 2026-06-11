"use client";

import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";

interface WavyMarqueeProps {
  text: string;
  headingId?: string;
  /** Pixels moved per animation frame (reference uses ~0.5) */
  speed?: number;
  waveIntensity?: number;
  direction?: "left" | "right";
  itemSpacing?: number;
  className?: string;
}

const PATH_START = -550;
const PATH_END = 2200;
const SVG_HEIGHT = 150;
const MID_Y = 59.58;
const REPEAT_COUNT = 12;

function generateWavePath(intensity: number): string {
  const peakY = MID_Y + intensity;

  return `M${PATH_START},${MID_Y} L${PATH_START},${MID_Y} S-183.15,${peakY} 0,${peakY} S366.85,${MID_Y} 550,${MID_Y} S916.85,${peakY} 1100,${peakY} S1466.85,${MID_Y} 1650,${MID_Y} S2016.85,${peakY} ${PATH_END},${peakY}`;
}

export function WavyMarquee({
  text,
  headingId,
  speed = 0.5,
  waveIntensity = 60,
  direction = "left",
  itemSpacing = 0.6,
  className,
}: WavyMarqueeProps) {
  const pathId = useId().replace(/:/g, "");
  const textPathRef = useRef<SVGTextPathElement>(null);
  const measureRef = useRef<HTMLSpanElement>(null);
  const [segmentWidth, setSegmentWidth] = useState<number | null>(null);

  const pathD = useMemo(
    () => generateWavePath(waveIntensity),
    [waveIntensity],
  );

  const viewBox = `${PATH_START} 0 ${PATH_END - PATH_START} ${SVG_HEIGHT}`;

  useLayoutEffect(() => {
    const measure = measureRef.current;
    if (!measure) return;

    const updateWidth = () => {
      const computedStyle = window.getComputedStyle(measure);
      const width = measure.offsetWidth + parseFloat(computedStyle.marginRight || "0");
      if (width > 0) setSegmentWidth(width);
    };

    updateWidth();
    const observer = new ResizeObserver(updateWidth);
    observer.observe(measure);
    return () => observer.disconnect();
  }, [text, itemSpacing]);

  useEffect(() => {
    const textPath = textPathRef.current;
    if (!textPath || !segmentWidth || segmentWidth <= 0) return;

    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    if (prefersReducedMotion) {
      textPath.setAttribute("startOffset", "0");
      return;
    }

    let offset = 0;
    let frameId = 0;
    const step = direction === "left" ? -speed : speed;

    const animate = () => {
      offset += step;

      if (offset <= -segmentWidth) {
        offset += segmentWidth;
      } else if (offset >= segmentWidth) {
        offset -= segmentWidth;
      }

      textPath.setAttribute("startOffset", String(offset));
      frameId = requestAnimationFrame(animate);
    };

    frameId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frameId);
  }, [direction, segmentWidth, speed]);

  return (
    <div className={`wavy-marquee${className ? ` ${className}` : ""}`}>
      <div className="wavy-marquee__measure" aria-hidden="true">
        <span
          ref={measureRef}
          className="wavy-marquee__measure-text"
          style={{ marginRight: `${itemSpacing}em` }}
        >
          {text}
        </span>
      </div>

      <div className="wavy-marquee__viewport">
        <svg
          className="wavy-marquee__svg"
          viewBox={viewBox}
          preserveAspectRatio="xMidYMid slice"
          aria-hidden="true"
        >
          <g transform="translate(0, 4.5)">
            <path
              id={pathId}
              className="wavy-marquee__path"
              d={pathD}
              fill="none"
            />
          </g>
          <text
            className="wavy-marquee__text"
            style={{ opacity: segmentWidth ? 1 : 0 }}
          >
            <textPath ref={textPathRef} href={`#${pathId}`} startOffset="0">
              {Array.from({ length: REPEAT_COUNT }).map((_, i) => (
                <tspan key={i} x={i * (segmentWidth ?? 0)}>
                  {text}
                </tspan>
              ))}
            </textPath>
          </text>
        </svg>
      </div>

      <span className="wavy-marquee__sr-only" id={headingId}>
        {text}
      </span>
    </div>
  );
}
