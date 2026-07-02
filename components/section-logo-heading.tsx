import Image from "next/image";
import { cn } from "@/lib/utils";

const CLOUDINARY_BASE = "https://res.cloudinary.com/daldas2e7/image/upload";

export const ABOUT_US_LOGO_URL = `${CLOUDINARY_BASE}/v1782952089/asosc/about-us-logo.webp`;

type SectionLogoHeadingProps = {
  id?: string;
  as?: "h1" | "h2";
  children: React.ReactNode;
  className?: string;
  logoSrc?: string;
};

export function SectionLogoHeading({
  id,
  as: Heading = "h2",
  children,
  className,
  logoSrc,
}: SectionLogoHeadingProps) {
  return (
    <Heading
      id={id}
      className={cn(
        "mb-6 flex flex-wrap items-center justify-center gap-3 text-center text-[clamp(2.5rem,6vw,4.5rem)] font-bold tracking-wide text-(--orange) sm:gap-4",
        className,
      )}
    >
      {logoSrc ? (
        <Image
          src={logoSrc}
          alt=""
          width={160}
          height={160}
          loading="eager"
          className="h-[1.9em] w-auto"
          aria-hidden="true"
        />
      ) : null}
      {children}
    </Heading>
  );
}
