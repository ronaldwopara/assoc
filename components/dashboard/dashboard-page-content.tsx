"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
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

export function DashboardPageContent() {
  const router = useRouter();
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [tabs, setTabs] = useState<DashboardTab[]>(() => [createTab("master-list")]);
  const [activeId, setActiveId] = useState<DashboardListId>("master-list");

  useEffect(() => {
    let cancelled = false;
    fetch("/api/dashboard/session")
      .then((res) => {
        if (!cancelled) setAuthed(res.ok);
      })
      .catch(() => {
        if (!cancelled) setAuthed(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

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

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError("");
    const res = await fetch("/api/dashboard/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    if (res.ok) {
      setAuthed(true);
      router.refresh();
    } else {
      setLoginError("Invalid password.");
    }
  };

  const handleLogout = async () => {
    await fetch("/api/dashboard/logout", { method: "POST" });
    setAuthed(false);
    router.refresh();
  };

  if (authed === null) {
    return (
      <div className="dash-login-wrap">
        <p className="dash-muted">Loading…</p>
      </div>
    );
  }

  if (!authed) {
    return (
      <div className="dash-login-wrap">
        <form className="dash-login-card" onSubmit={handleLogin}>
          <h1 className="dash-login-title">Operations Hub</h1>
          <p className="dash-muted">Staff sign-in (password for now).</p>
          <label className="dash-field">
            <span>Password</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              className="focus-ring-light"
            />
          </label>
          {loginError && <p className="dash-error">{loginError}</p>}
          <button type="submit" className="dash-primary-btn focus-ring-light">
            Sign in
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="dash-shell">
      <DashboardSidebar
        collapsed={sidebarCollapsed}
        activeId={activeId}
        onToggleCollapse={() => setSidebarCollapsed((c) => !c)}
        onOpenList={openList}
      />

      <div className="dash-main">
        <header className="dash-topbar">
          <DashboardTabStrip
            tabs={tabs}
            activeId={activeId}
            onSelect={selectTab}
            onClose={closeTab}
          />
          <button
            type="button"
            className="dash-logout-btn focus-ring-light"
            onClick={handleLogout}
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
