"use client";

import {
  useCallback,
  useEffect,
  useState,
  type ComponentPropsWithoutRef,
  type ReactNode,
  type VideoHTMLAttributes,
} from "react";
import { cn } from "@/lib/utils";

export type MediaPlaceholderTone = "cream" | "ink" | "orange" | "black";

/**
 * URLs that have already produced a decodable frame in this session.
 * Opening a program remounts a second <video> for the same Cloudinary URL —
 * without this, the placeholder sheen reappears even though the bytes are
 * already in the HTTP cache.
 */
const warmedMediaUrls = new Set<string>();

function mediaSrcKey(src: string | undefined | null): string | null {
  if (!src || typeof src !== "string") return null;
  return src;
}

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
export function useMediaLoaded(src?: string | null) {
  const key = mediaSrcKey(src);
  const [loaded, setLoaded] = useState(() => (key ? warmedMediaUrls.has(key) : false));

  const markLoaded = useCallback(() => {
    if (key) warmedMediaUrls.add(key);
    setLoaded(true);
  }, [key]);

  useEffect(() => {
    if (key && warmedMediaUrls.has(key)) {
      setLoaded(true);
      return;
    }
    // New src that hasn't warmed yet — show the placeholder until it loads.
    if (key) setLoaded(false);
  }, [key]);

  const imgRef = useCallback(
    (node: HTMLImageElement | null) => {
      // `complete` is true once the browser has finished trying (success or error),
      // so this also clears the placeholder for a cached-but-broken image.
      if (node?.complete) markLoaded();
    },
    [markLoaded],
  );

  const videoRef = useCallback(
    (node: HTMLVideoElement | null) => {
      if (!node) return;
      // HAVE_CURRENT_DATA (2) or greater means a frame is already decodable.
      if (node.readyState >= 2) {
        markLoaded();
        return;
      }
      // Warm HTTP cache: readyState can jump a frame after mount without a
      // second loadeddata if we attached too early — re-check shortly after.
      const check = () => {
        if (node.readyState >= 2) markLoaded();
      };
      requestAnimationFrame(() => {
        check();
        requestAnimationFrame(check);
      });
    },
    [markLoaded],
  );

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
  tone = "cream",
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
  tone = "cream",
  wrapperClassName,
  showSheen = true,
  className,
  onLoad,
  onError,
  src,
  ...props
}: MediaPlaceholderImageProps) {
  const { loaded, markLoaded, imgRef } = useMediaLoaded(
    typeof src === "string" ? src : null,
  );

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
        src={src}
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
  tone = "black",
  wrapperClassName,
  showSheen = true,
  className,
  onLoadedData,
  onCanPlay,
  onError,
  src,
  ...props
}: MediaPlaceholderVideoProps) {
  const { loaded, markLoaded, videoRef } = useMediaLoaded(
    typeof src === "string" ? src : null,
  );

  return (
    <MediaPlaceholder
      loaded={loaded}
      tone={tone}
      showSheen={showSheen}
      className={wrapperClassName}
    >
      <video
        {...props}
        src={src}
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
        onCanPlay={(event) => {
          markLoaded();
          onCanPlay?.(event);
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
