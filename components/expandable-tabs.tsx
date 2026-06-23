"use client";

import { useLayoutEffect, useRef } from "react";
import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface Tab {
  title: string;
  icon: LucideIcon;
  type?: never;
}

interface Separator {
  type: "separator";
  title?: never;
  icon?: never;
}

type TabItem = Tab | Separator;

interface ExpandableTabsProps {
  tabs: TabItem[];
  className?: string;
  activeColor?: string;
  selected?: number | null;
  onChange?: (index: number | null) => void;
}

function scrollActiveTabIntoView(
  container: HTMLDivElement,
  tab: HTMLButtonElement,
) {
  const tabOffsetLeft = tab.offsetLeft;
  const tabWidth = tab.offsetWidth;
  const containerWidth = container.clientWidth;
  const maxScroll = container.scrollWidth - containerWidth;

  if (maxScroll <= 0) return;

  const targetScroll = tabOffsetLeft - (containerWidth - tabWidth) / 2;
  container.scrollLeft = Math.max(0, Math.min(targetScroll, maxScroll));
}

export function ExpandableTabs({
  tabs,
  className,
  activeColor = "text-(--orange)",
  selected = null,
  onChange,
}: ExpandableTabsProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);

  useLayoutEffect(() => {
    if (selected === null || selected === undefined) return;

    const container = scrollRef.current;
    const tab = tabRefs.current[selected];
    if (!container || !tab) return;

    const scroll = () => scrollActiveTabIntoView(container, tab);

    scroll();
    const raf = requestAnimationFrame(scroll);

    return () => cancelAnimationFrame(raf);
  }, [selected]);

  const Separator = () => (
    <div className="mx-1 h-[24px] w-[1.2px] shrink-0 bg-(--brown-dark)/15" aria-hidden="true" />
  );

  return (
    <div
      className={cn(
        "max-w-full overflow-hidden rounded-2xl border border-(--cream-light)/15 bg-[#2a2a2a] p-1.5 backdrop-blur-sm sm:p-3",
        className,
      )}
    >
      <div
        ref={scrollRef}
        className="flex flex-nowrap items-center gap-1 overflow-x-auto scrollbar-none sm:gap-2"
      >
        {tabs.map((tab, index) => {
          if (tab.type === "separator") {
            return <Separator key={`separator-${index}`} />;
          }

          const Icon = tab.icon;
          const isSelected = selected === index;

          return (
            <button
              key={tab.title}
              ref={(el) => {
                tabRefs.current[index] = el;
              }}
              type="button"
              onClick={() => onChange?.(index)}
              className={cn(
                "relative flex cursor-pointer items-center rounded-xl py-2 text-[10px] font-bold uppercase tracking-wide transition-colors duration-200 focus-ring-light sm:py-5 sm:text-base",
                isSelected
                  ? cn("shrink-0 gap-2 px-4 sm:gap-2.5 sm:px-4", activeColor, "bg-(--hero-cta)/15")
                  : "shrink gap-0 px-2 text-(--orange)/75 hover:bg-white/5 hover:text-(--orange) sm:px-2",
              )}
            >
              <Icon className="h-4 w-4 shrink-0 sm:h-[26px] sm:w-[26px]" />
              {isSelected && (
                <span className="whitespace-nowrap">{tab.title}</span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
