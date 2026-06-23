"use client";

import React from "react";
import { useInView } from "framer-motion";
import { AspectRatio } from "@/components/ui/aspect-ratio";
import { getGalleryImages, type GalleryImage } from "@/lib/gallery-images";
import { cn } from "@/lib/utils";

const COLUMN_COUNT = 3;

function distributeIntoColumns(images: GalleryImage[], columnCount: number) {
  const columns: GalleryImage[][] = Array.from({ length: columnCount }, () => []);

  images.forEach((image, index) => {
    columns[index % columnCount].push(image);
  });

  return columns;
}

export function ImageGallery() {
  const images = getGalleryImages();
  const columns = distributeIntoColumns(images, COLUMN_COUNT);

  return (
    <div className="relative flex min-h-screen w-full flex-col items-center justify-center px-4 py-10">
      <div className="mx-auto grid w-full max-w-5xl gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {columns.map((column, col) => (
          <div key={col} className="grid gap-6">
            {column.map((image) => (
              <AnimatedImage
                key={`${col}-${image.src}`}
                alt={image.alt}
                src={image.src}
                ratio={image.ratio}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

interface AnimatedImageProps {
  alt: string;
  src: string;
  className?: string;
  ratio: number;
}

function AnimatedImage({ alt, src, ratio, className }: AnimatedImageProps) {
  const ref = React.useRef(null);
  const isInView = useInView(ref, { once: true });
  const [isLoading, setIsLoading] = React.useState(true);
  const [imgSrc, setImgSrc] = React.useState(src);

  const handleError = () => {
    setImgSrc(src);
    setIsLoading(false);
  };

  return (
    <AspectRatio
      ref={ref}
      ratio={ratio}
      className={cn(
        "relative size-full rounded-lg border border-(--gold)/20 bg-black/5",
        className,
      )}
    >
      <img
        alt={alt}
        src={imgSrc}
        className={cn(
          "size-full rounded-lg object-cover opacity-0 transition-all duration-1000 ease-in-out",
          {
            "opacity-100": isInView && !isLoading,
          },
        )}
        onLoad={() => setIsLoading(false)}
        loading="lazy"
        onError={handleError}
      />
    </AspectRatio>
  );
}
