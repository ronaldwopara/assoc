"use client";

import { useState } from "react";
import { Menu } from "lucide-react";
import type { DashboardListId } from "@/lib/dashboard-lists";
import { DashboardSidebar } from "@/components/dashboard/dashboard-sidebar";
import { DashboardListPanel } from "@/components/dashboard/dashboard-list-panel";
import { DashboardEmailTemplatePanel } from "@/components/dashboard/dashboard-email-template-panel";

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
  const [activeId, setActiveId] = useState<DashboardListId>("master-list");

  return (
    <div className="dash-shell">
      <DashboardSidebar
        collapsed={sidebarCollapsed}
        mobileOpen={mobileNavOpen}
        activeId={activeId}
        onToggleCollapse={() => setSidebarCollapsed((c) => !c)}
        onCloseMobile={() => setMobileNavOpen(false)}
        onOpenList={setActiveId}
        onLogout={onLogout}
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
          <button
            type="button"
            className="dash-logout-btn focus-ring-light"
            onClick={onLogout}
          >
            Sign out
          </button>
        </header>

        <div className="dash-content">
          {activeId === "email-membership-followup" ? (
            <DashboardEmailTemplatePanel />
          ) : (
            <DashboardListPanel listId={activeId} />
          )}
        </div>
      </div>
    </div>
  );
}
