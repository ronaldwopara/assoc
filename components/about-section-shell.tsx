import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

interface AboutSectionShellProps {
  id?: string;
  className?: string;
  "aria-labelledby"?: string;
  children: ReactNode;
}

export function AboutSectionShell({
  id,
  className,
  "aria-labelledby": labelledBy,
  children,
}: AboutSectionShellProps) {
  return (
    <section
      id={id}
      className={cn(
        "about-section-shell section-shell bg-(--cream-light)",
        className,
      )}
      aria-labelledby={labelledBy}
    >
      <div className="about-section-shell__content">{children}</div>
    </section>
  );
}
