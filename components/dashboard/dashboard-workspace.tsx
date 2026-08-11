"use client";

import { useCallback, useState } from "react";
import { Menu } from "lucide-react";
import type { DashboardListId } from "@/lib/dashboard-lists";
import {
  closeTabInSet,
  createTab,
  openTabInSet,
  type DashboardTab,
} from "@/lib/dashboard-tabs";
import { DashboardSidebar } from "@/components/dashboard/dashboard-sidebar";
import { DashboardTabStrip } from "@/components/dashboard/dashboard-tab-strip";
import { DashboardListPanel } from "@/components/dashboard/dashboard-list-panel";

interface DashboardWorkspaceProps {
  onBack: () => void;
  onHome: () => void;
  onLogout: () => void;
}

/** Authenticated Operations Hub UI — used as an in-page /upgrade tool. */
export function DashboardWorkspace({
  onBack,
  onHome,
  onLogout,
}: DashboardWorkspaceProps) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [tabs, setTabs] = useState<DashboardTab[]>(() => [createTab("master-list")]);
  const [activeId, setActiveId] = useState<DashboardListId>("master-list");

  const openList = useCallback((listId: DashboardListId) => {
    setTabs((prev) => {
      const next = openTabInSet(prev, listId);
      setActiveId(next.activeId);
      return next.tabs;
    });
  }, []);

  const selectTab = useCallback((listId: DashboardListId) => {
    setActiveId(listId);
  }, []);

  const closeTab = useCallback(
    (listId: DashboardListId) => {
      setTabs((prev) => {
        const next = closeTabInSet(prev, activeId, listId);
        setActiveId(next.activeId);
        return next.tabs;
      });
    },
    [activeId],
  );

  return (
    <div className="dash-shell">
      <DashboardSidebar
        collapsed={sidebarCollapsed}
        mobileOpen={mobileNavOpen}
        activeId={activeId}
        onToggleCollapse={() => setSidebarCollapsed((c) => !c)}
        onCloseMobile={() => setMobileNavOpen(false)}
        onOpenList={openList}
      />

      <div className="dash-main">
        <header className="dash-topbar">
          <button
            type="button"
            className="dash-menu-btn focus-ring-light"
            onClick={() => setMobileNavOpen(true)}
            aria-label="Open navigation"
          >
            <Menu size={20} />
          </button>
          <div className="dash-topbar-nav">
            <button
              type="button"
              className="dash-nav-chip focus-ring-light"
              onClick={onBack}
            >
              ← All tools
            </button>
            <button
              type="button"
              className="dash-nav-chip focus-ring-light"
              onClick={onHome}
            >
              Home
            </button>
          </div>
          <DashboardTabStrip
            tabs={tabs}
            activeId={activeId}
            onSelect={selectTab}
            onClose={closeTab}
          />
          <button
            type="button"
            className="dash-logout-btn focus-ring-light"
            onClick={onLogout}
          >
            Sign out
          </button>
        </header>

        <div className="dash-content">
          <DashboardListPanel listId={activeId} />
        </div>
      </div>
    </div>
  );
}
