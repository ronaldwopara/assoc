"use client";

import {
  Users,
  Store,
  Mail,
  Contact,
  IdCard,
  List,
  Calendar,
  BadgeCheck,
  HandCoins,
  MailPlus,
  PanelLeftClose,
  PanelLeft,
  X,
} from "lucide-react";
import type { DashboardListId } from "@/lib/dashboard-lists";
import { DASHBOARD_LISTS } from "@/lib/dashboard-lists";

const ICONS: Record<DashboardListId, typeof List> = {
  "master-list": List,
  "master-volunteer": Users,
  "master-vendor": Store,
  "master-guests": Contact,
  "master-newsletter": Mail,
  "master-members": IdCard,
  "master-events": Calendar,
  "payment-review-membership": BadgeCheck,
  "payment-review-donations": HandCoins,
  "email-membership-followup": MailPlus,
};

interface DashboardSidebarProps {
  collapsed: boolean;
  /** Mobile-only: sidebar renders as a full-width overlay drawer when true. */
  mobileOpen: boolean;
  activeId: DashboardListId;
  onToggleCollapse: () => void;
  onCloseMobile: () => void;
  onOpenList: (id: DashboardListId) => void;
  /** Mobile-only: Sign out lives at the bottom of the drawer (see dashboard.css). */
  onLogout: () => void;
}

export function DashboardSidebar({
  collapsed,
  mobileOpen,
  activeId,
  onToggleCollapse,
  onCloseMobile,
  onOpenList,
  onLogout,
}: DashboardSidebarProps) {
  return (
    <>
      {/* Mobile only (see dashboard.css) — dims and closes the drawer on tap. */}
      <button
        type="button"
        className={`dash-sidebar-backdrop${mobileOpen ? " dash-sidebar-backdrop--visible" : ""}`}
        onClick={onCloseMobile}
        aria-hidden={!mobileOpen}
        tabIndex={-1}
      />

      <aside
        className={`dash-sidebar${collapsed ? " dash-sidebar--collapsed" : ""}${mobileOpen ? " dash-sidebar--mobile-open" : ""}`}
        aria-label="Dashboard navigation"
      >
        <div className="dash-sidebar-head">
          {(!collapsed || mobileOpen) && <span className="dash-sidebar-brand">Dashboard</span>}
          <button
            type="button"
            className="dash-icon-btn dash-icon-btn--collapse focus-ring-light"
            onClick={onToggleCollapse}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? <PanelLeft size={18} /> : <PanelLeftClose size={18} />}
          </button>
          <button
            type="button"
            className="dash-icon-btn dash-icon-btn--close focus-ring-light"
            onClick={onCloseMobile}
            aria-label="Close navigation"
          >
            <X size={18} />
          </button>
        </div>

        <nav className="dash-sidebar-nav">
          {DASHBOARD_LISTS.map((list) => {
            const Icon = ICONS[list.id];
            const active = activeId === list.id;
            return (
              <button
                key={list.id}
                type="button"
                className={`dash-nav-item focus-ring-light${active ? " dash-nav-item--active" : ""}`}
                onClick={() => {
                  onOpenList(list.id);
                  onCloseMobile();
                }}
                title={list.title}
              >
                <Icon size={18} aria-hidden />
                <span className="dash-nav-label">{list.title}</span>
              </button>
            );
          })}
        </nav>

        {/* Mobile-only — see dashboard.css; sits at the bottom of the drawer below the (flex:1) nav. */}
        <button type="button" className="dash-sidebar-signout focus-ring-light" onClick={onLogout}>
          Sign out
        </button>
      </aside>
    </>
  );
}
