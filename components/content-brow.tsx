import { cn } from "@/lib/utils";

type ContentBrowProps = {
  children: React.ReactNode;
  theme?: "light" | "dark";
  className?: string;
};

export function ContentBrow({ children, theme = "light", className }: ContentBrowProps) {
  return (
    <span
      className={cn(
        "inline-block rounded-full bg-(--hero-cta)/20 px-4 py-1 text-sm font-bold uppercase tracking-wide",
        theme === "dark" ? "text-(--orange)" : "text-black",
        className,
      )}
    >
      {children}
    </span>
  );
}
