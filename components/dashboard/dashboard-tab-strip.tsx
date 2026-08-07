"use client";

import { X } from "lucide-react";
import type { DashboardTab } from "@/lib/dashboard-tabs";
import type { DashboardListId } from "@/lib/dashboard-lists";

interface DashboardTabStripProps {
  tabs: DashboardTab[];
  activeId: DashboardListId;
  onSelect: (id: DashboardListId) => void;
  onClose: (id: DashboardListId) => void;
}

export function DashboardTabStrip({
  tabs,
  activeId,
  onSelect,
  onClose,
}: DashboardTabStripProps) {
  return (
    <div className="dash-tab-strip" role="tablist" aria-label="Open lists">
      {tabs.map((tab) => {
        const active = tab.id === activeId;
        return (
          <div
            key={tab.id}
            className={`dash-tab${active ? " dash-tab--active" : ""}`}
            role="tab"
            aria-selected={active}
          >
            <button
              type="button"
              className="dash-tab-label focus-ring-light"
              onClick={() => onSelect(tab.id)}
            >
              {tab.title}
            </button>
            {tabs.length > 1 && (
              <button
                type="button"
                className="dash-tab-close focus-ring-light"
                onClick={() => onClose(tab.id)}
                aria-label={`Close ${tab.title}`}
              >
                <X size={14} />
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
