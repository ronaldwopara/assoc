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
  /** Dims the control while still allowing a wake/confirm tap. */
  muted?: boolean;
}

function scrollActiveTabIntoView(
  container: HTMLDivElement,
  tab: HTMLButtonElement,
) {
  const containerWidth = container.clientWidth;
  const maxScroll = container.scrollWidth - containerWidth;

  if (maxScroll <= 0) {
    container.scrollLeft = 0;
    return;
  }

  const targetScroll = tab.offsetLeft - (containerWidth - tab.offsetWidth) / 2;
  container.scrollLeft = Math.max(0, Math.min(targetScroll, maxScroll));
}

export function ExpandableTabs({
  tabs,
  className,
  activeColor = "text-(--orange)",
  selected = null,
  onChange,
  muted = false,
}: ExpandableTabsProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);

  useLayoutEffect(() => {
    if (selected === null || selected === undefined) return;

    const container = scrollRef.current;
    const root = rootRef.current;
    if (!container) return;

    const syncScroll = () => {
      const tab = tabRefs.current[selected];
      if (!tab) return;
      scrollActiveTabIntoView(container, tab);
    };

    syncScroll();
    const raf = requestAnimationFrame(syncScroll);

    const resizeObserver = new ResizeObserver(() => {
      syncScroll();
    });
    resizeObserver.observe(container);
    if (root) resizeObserver.observe(root);

    return () => {
      cancelAnimationFrame(raf);
      resizeObserver.disconnect();
    };
  }, [selected]);

  const Separator = () => (
    <div className="mx-1 h-6 w-px shrink-0 bg-(--brown-dark)/15" aria-hidden="true" />
  );

  return (
    <div
      ref={rootRef}
      aria-disabled={muted || undefined}
      title={muted ? "Tap once to unlock, then again to switch" : undefined}
      className={cn(
        // Hug content width; parent caps max width between the chevrons.
        // When content exceeds that cap, the inner row scrolls — no hollow right gap.
        "inline-flex max-w-full min-w-0 overflow-hidden rounded-2xl border border-(--cream-light)/15 bg-[#2a2a2a] p-1.5 backdrop-blur-sm transition-opacity duration-200",
        muted && "opacity-70",
        className,
      )}
    >
      <div
        ref={scrollRef}
        className="flex max-w-full flex-nowrap items-center gap-1.5 overflow-x-auto scrollbar-none"
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
              aria-label={
                muted
                  ? `${tab.title} (locked — tap to unlock)`
                  : tab.title
              }
              onClick={() => onChange?.(index)}
              className={cn(
                "relative flex shrink-0 cursor-pointer items-center rounded-xl py-2 text-[10px] font-bold uppercase tracking-wide transition-colors duration-200 focus-ring-light",
                isSelected
                  ? cn("gap-2 px-3.5", activeColor, "bg-(--hero-cta)/15")
                  : "gap-0 px-2.5 text-(--orange)/75 hover:bg-white/5 hover:text-(--orange)",
              )}
            >
              <Icon className="h-6 w-6 shrink-0" strokeWidth={2} />
              {isSelected && <span className="whitespace-nowrap">{tab.title}</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}
