import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { cn } from "@/lib/utils";

type PageBackLinkProps = {
  href?: string;
  label?: string;
  theme?: "light" | "dark";
  className?: string;
};

export function PageBackLink({
  href = "/#home",
  label = "Home",
  theme = "light",
  className,
}: PageBackLinkProps) {
  return (
    <Link
      href={href}
      className={cn(
        "page-back-link focus-ring",
        theme === "dark" && "page-back-link--dark",
        className,
      )}
    >
      <ChevronLeft className="page-back-link__icon" aria-hidden />
      {label}
    </Link>
  );
}
