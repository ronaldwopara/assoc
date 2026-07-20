"use client";

import {
  useCallback,
  useState,
  type ComponentPropsWithoutRef,
  type ReactNode,
  type VideoHTMLAttributes,
} from "react";
import { cn } from "@/lib/utils";

export type MediaPlaceholderTone = "light" | "dark" | "neutral";

/**
 * A plain <img>/<video> only fires onLoad/onLoadedData for a load that finishes
 * *after* React attaches the handler. When the resource is already complete on
 * mount — SSR hydration, bfcache restore, a warm HTTP cache, or a remount — that
 * event never arrives, and a placeholder keyed off it would stay up forever
 * (image invisible, sheen looping). These ref callbacks re-check the element the
 * instant it mounts and reveal immediately if it is already done.
 *
 * (next/image handles the cached case internally via its own ref, so it does not
 * need this — only bare <img>/<video> elements do.)
 */
export function useMediaLoaded() {
  const [loaded, setLoaded] = useState(false);
  const markLoaded = useCallback(() => setLoaded(true), []);

  const imgRef = useCallback((node: HTMLImageElement | null) => {
    // `complete` is true once the browser has finished trying (success or error),
    // so this also clears the placeholder for a cached-but-broken image.
    if (node?.complete) setLoaded(true);
  }, []);

  const videoRef = useCallback((node: HTMLVideoElement | null) => {
    // HAVE_CURRENT_DATA (2) or greater means a frame is already decodable.
    if (node && node.readyState >= 2) setLoaded(true);
  }, []);

  return { loaded, markLoaded, imgRef, videoRef };
}

type MediaPlaceholderProps = {
  loaded: boolean;
  tone?: MediaPlaceholderTone;
  showSheen?: boolean;
  className?: string;
  children?: ReactNode;
};

export function MediaPlaceholder({
  loaded,
  tone = "light",
  showSheen = true,
  className,
  children,
}: MediaPlaceholderProps) {
  return (
    <div
      className={cn(
        "media-placeholder",
        `media-placeholder--${tone}`,
        loaded && "media-placeholder--loaded",
        !showSheen && "media-placeholder--no-sheen",
        className,
      )}
    >
      <div className="media-placeholder__base" aria-hidden="true" />
      {showSheen && <div className="media-placeholder__sheen" aria-hidden="true" />}
      {children}
    </div>
  );
}

type MediaPlaceholderImageProps = Omit<
  ComponentPropsWithoutRef<"img">,
  "onLoad" | "onError"
> & {
  tone?: MediaPlaceholderTone;
  wrapperClassName?: string;
  showSheen?: boolean;
  onLoad?: () => void;
  onError?: () => void;
};

export function MediaPlaceholderImage({
  tone = "light",
  wrapperClassName,
  showSheen = true,
  className,
  onLoad,
  onError,
  ...props
}: MediaPlaceholderImageProps) {
  const { loaded, markLoaded, imgRef } = useMediaLoaded();

  return (
    <MediaPlaceholder
      loaded={loaded}
      tone={tone}
      showSheen={showSheen}
      className={wrapperClassName}
    >
      {/* alt is supplied by callers via {...props}; the linter can't see it statically */}
      {/* eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text */}
      <img
        {...props}
        ref={imgRef}
        className={cn(
          "media-placeholder__media transition-opacity duration-300 ease-out",
          loaded ? "opacity-100" : "opacity-0",
          className,
        )}
        onLoad={() => {
          markLoaded();
          onLoad?.();
        }}
        onError={() => {
          markLoaded();
          onError?.();
        }}
      />
    </MediaPlaceholder>
  );
}

type MediaPlaceholderVideoProps = VideoHTMLAttributes<HTMLVideoElement> & {
  tone?: MediaPlaceholderTone;
  wrapperClassName?: string;
  showSheen?: boolean;
};

export function MediaPlaceholderVideo({
  tone = "dark",
  wrapperClassName,
  showSheen = true,
  className,
  onLoadedData,
  onError,
  ...props
}: MediaPlaceholderVideoProps) {
  const { loaded, markLoaded, videoRef } = useMediaLoaded();

  return (
    <MediaPlaceholder
      loaded={loaded}
      tone={tone}
      showSheen={showSheen}
      className={wrapperClassName}
    >
      <video
        {...props}
        ref={videoRef}
        className={cn(
          "media-placeholder__media transition-opacity duration-300 ease-out",
          loaded ? "opacity-100" : "opacity-0",
          className,
        )}
        onLoadedData={(event) => {
          markLoaded();
          onLoadedData?.(event);
        }}
        onError={(event) => {
          // A video that errors (or is already buffered) must still clear the
          // placeholder — otherwise the sheen loops indefinitely.
          markLoaded();
          onError?.(event);
        }}
      />
    </MediaPlaceholder>
  );
}
