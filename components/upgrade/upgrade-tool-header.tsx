"use client";

import { useEffect, type ReactNode } from "react";

export type UpgradeStatus = { type: "idle" | "ok" | "error"; message: string };

interface UpgradeToolHeaderProps {
  title: string;
  description: string;
  isDirty: boolean;
  saving: boolean;
  status: UpgradeStatus;
  onBack: () => void;
  onHome: () => void;
  onSave: () => void;
  onLogout: () => void;
  /** When false, hide the Save button (read-only tools). Default true. */
  showSave?: boolean;
  children?: ReactNode;
}

export function UpgradeToolHeader({
  title,
  description,
  isDirty,
  saving,
  status,
  onBack,
  onHome,
  onSave,
  onLogout,
  showSave = true,
  children,
}: UpgradeToolHeaderProps) {
  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <button
            type="button"
            onClick={onBack}
            className="mb-3 inline-flex min-h-10 cursor-pointer items-center rounded-lg border border-(--ink)/15 bg-white/80 px-3 text-sm font-medium text-(--ink) transition hover:bg-white"
          >
            ← All tools
          </button>
          <h1 className="text-3xl font-semibold text-(--ink)">{title}</h1>
          <p className="mt-2 max-w-xl text-sm text-(--ink)/70">{description}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {isDirty && !saving && showSave && (
            <span className="text-sm font-medium text-amber-700" role="status">
              Unsaved changes
            </span>
          )}
          {showSave && (
            <button
              type="button"
              onClick={onSave}
              disabled={saving}
              className="hero-cta-btn inline-flex min-h-11 cursor-pointer items-center justify-center px-6 text-sm font-semibold text-black disabled:opacity-60"
            >
              {saving ? "Saving…" : "Save"}
            </button>
          )}
          <button
            type="button"
            onClick={onHome}
            className="inline-flex min-h-11 cursor-pointer items-center justify-center rounded-lg border border-(--ink)/20 bg-white/80 px-4 text-sm font-medium text-(--ink) transition hover:bg-white"
          >
            Home
          </button>
          <button
            type="button"
            onClick={onLogout}
            className="inline-flex min-h-11 cursor-pointer items-center justify-center rounded-lg border border-(--ink)/20 px-4 text-sm font-medium text-(--ink)"
          >
            Log out
          </button>
        </div>
      </div>

      {status.message && (
        <p
          className={`mt-4 text-sm ${status.type === "error" ? "text-red-700" : "text-emerald-800"}`}
          role="status"
        >
          {status.message}
        </p>
      )}

      {children}
    </>
  );
}

export function useUpgradeDirtyGuard(isDirty: boolean) {
  useEffect(() => {
    if (!isDirty) return;
    const handler = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isDirty]);
}
