"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { LayoutGroup } from "framer-motion";
import type { GalleryCmsData } from "@/lib/gallery-cms/types";
import type { DocumentsCmsData } from "@/lib/documents-cms/types";
import type { PopupCmsData } from "@/lib/popup-cms/types";
import {
  isValidUpgradeToolId,
  type UpgradeToolId,
} from "@/lib/upgrade-tools";
import { DashboardWorkspace } from "@/components/dashboard/dashboard-workspace";
import { UpgradeAnnouncementEditor } from "@/components/upgrade/upgrade-announcement-editor";
import { UpgradeChooser } from "@/components/upgrade/upgrade-chooser";
import { UpgradeDocumentsEditor } from "@/components/upgrade/upgrade-documents-editor";
import { UpgradeGalleryEditor } from "@/components/upgrade/upgrade-gallery-editor";
import { UpgradePopupEditor } from "@/components/upgrade/upgrade-popup-editor";
import type { UpgradeStatus } from "@/components/upgrade/upgrade-tool-header";

type UpgradePageContentProps = {
  initialGalleryData: GalleryCmsData;
  initialDocumentsData: DocumentsCmsData;
  initialPopupData: PopupCmsData;
};

function UpgradePageContentInner({
  initialGalleryData,
  initialDocumentsData,
  initialPopupData,
}: UpgradePageContentProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const rawTool = searchParams.get("tool");
  const activeTool = isValidUpgradeToolId(rawTool) ? rawTool : null;

  const [authed, setAuthed] = useState<boolean | null>(null);
  const [password, setPassword] = useState("");
  const [galleryData, setGalleryData] = useState<GalleryCmsData>(initialGalleryData);
  const [savedGalleryData, setSavedGalleryData] =
    useState<GalleryCmsData>(initialGalleryData);
  const [documentsData, setDocumentsData] =
    useState<DocumentsCmsData>(initialDocumentsData);
  const [savedDocumentsData, setSavedDocumentsData] =
    useState<DocumentsCmsData>(initialDocumentsData);
  const [popupData, setPopupData] = useState<PopupCmsData>(initialPopupData);
  const [savedPopupData, setSavedPopupData] = useState<PopupCmsData>(initialPopupData);
  const [gallerySaving, setGallerySaving] = useState(false);
  const [documentsSaving, setDocumentsSaving] = useState(false);
  const [popupSaving, setPopupSaving] = useState(false);
  const [galleryStatus, setGalleryStatus] = useState<UpgradeStatus>({
    type: "idle",
    message: "",
  });
  const [documentsStatus, setDocumentsStatus] = useState<UpgradeStatus>({
    type: "idle",
    message: "",
  });
  const [popupStatus, setPopupStatus] = useState<UpgradeStatus>({
    type: "idle",
    message: "",
  });
  const [loginStatus, setLoginStatus] = useState<UpgradeStatus>({
    type: "idle",
    message: "",
  });

  useEffect(() => {
    let cancelled = false;
    fetch("/api/upgrade/session")
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

  const openTool = useCallback(
    (tool: UpgradeToolId) => {
      router.push(`/upgrade?tool=${tool}`);
    },
    [router],
  );

  const backToHub = useCallback(() => {
    router.push("/upgrade");
  }, [router]);

  const goHome = useCallback(() => {
    router.push("/");
  }, [router]);

  const login = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoginStatus({ type: "idle", message: "" });
    const res = await fetch("/api/upgrade/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    const body = (await res.json()) as { error?: string };
    if (!res.ok) {
      setLoginStatus({ type: "error", message: body.error ?? "Login failed" });
      return;
    }
    setPassword("");
    setAuthed(true);

    const [galleryRes, documentsRes, popupRes] = await Promise.all([
      fetch("/api/upgrade/content"),
      fetch("/api/upgrade/documents"),
      fetch("/api/upgrade/popup"),
    ]);
    if (galleryRes.ok) {
      const fresh = (await galleryRes.json()) as GalleryCmsData;
      setGalleryData(fresh);
      setSavedGalleryData(fresh);
    }
    if (documentsRes.ok) {
      const fresh = (await documentsRes.json()) as DocumentsCmsData;
      setDocumentsData(fresh);
      setSavedDocumentsData(fresh);
    }
    if (popupRes.ok) {
      const fresh = (await popupRes.json()) as PopupCmsData;
      setPopupData(fresh);
      setSavedPopupData(fresh);
    }
  };

  const logout = async () => {
    await fetch("/api/upgrade/logout", { method: "POST" });
    setAuthed(false);
    router.push("/upgrade");
  };

  const saveGallery = async () => {
    setGallerySaving(true);
    setGalleryStatus({ type: "idle", message: "" });
    try {
      const res = await fetch("/api/upgrade/content", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(galleryData),
      });
      const body = (await res.json()) as GalleryCmsData & { error?: string };
      if (!res.ok) {
        setGalleryStatus({ type: "error", message: body.error ?? "Save failed" });
        return;
      }
      setGalleryData(body);
      setSavedGalleryData(body);
      setGalleryStatus({
        type: "ok",
        message:
          activeTool === "announcement"
            ? "Saved. The announcement bar will use this content now."
            : "Saved. Removed preview images were deleted from Cloudinary. The public gallery will use this content now.",
      });
      router.refresh();
    } catch {
      setGalleryStatus({ type: "error", message: "Save failed" });
    } finally {
      setGallerySaving(false);
    }
  };

  const saveDocuments = async () => {
    setDocumentsSaving(true);
    setDocumentsStatus({ type: "idle", message: "" });
    try {
      const res = await fetch("/api/upgrade/documents", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(documentsData),
      });
      const body = (await res.json()) as DocumentsCmsData & { error?: string };
      if (!res.ok) {
        setDocumentsStatus({ type: "error", message: body.error ?? "Save failed" });
        return;
      }
      setDocumentsData(body);
      setSavedDocumentsData(body);
      setDocumentsStatus({
        type: "ok",
        message:
          "Saved. Removed Cloudinary documents were deleted. The About Us documents section will use this content now.",
      });
      router.refresh();
    } catch {
      setDocumentsStatus({ type: "error", message: "Save failed" });
    } finally {
      setDocumentsSaving(false);
    }
  };

  const savePopup = async () => {
    setPopupSaving(true);
    setPopupStatus({ type: "idle", message: "" });
    try {
      const res = await fetch("/api/upgrade/popup", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(popupData),
      });
      const body = (await res.json()) as PopupCmsData & { error?: string };
      if (!res.ok) {
        setPopupStatus({ type: "error", message: body.error ?? "Save failed" });
        return;
      }
      setPopupData(body);
      setSavedPopupData(body);
      setPopupStatus({
        type: "ok",
        message:
          "Saved. The homepage flyer popup will use this content now.",
      });
      router.refresh();
    } catch {
      setPopupStatus({ type: "error", message: "Save failed" });
    } finally {
      setPopupSaving(false);
    }
  };

  const hubDirty = useMemo(() => {
    if (!authed) return false;
    return (
      JSON.stringify(galleryData) !== JSON.stringify(savedGalleryData) ||
      JSON.stringify(documentsData) !== JSON.stringify(savedDocumentsData) ||
      JSON.stringify(popupData) !== JSON.stringify(savedPopupData)
    );
  }, [
    authed,
    galleryData,
    savedGalleryData,
    documentsData,
    savedDocumentsData,
    popupData,
    savedPopupData,
  ]);

  useEffect(() => {
    if (!hubDirty || activeTool) return;
    const handler = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [hubDirty, activeTool]);

  if (authed === null) {
    return (
      <p className="mx-auto max-w-md px-5 py-16 text-center text-(--ink)/70">
        Checking access…
      </p>
    );
  }

  if (!authed) {
    return (
      <form
        onSubmit={login}
        className="mx-auto max-w-md rounded-2xl bg-white/70 px-6 py-8 shadow-sm"
        style={{ marginTop: "max(2.5rem, calc(1.25rem + var(--safe-top)))" }}
      >
        <h1 className="text-2xl font-semibold text-(--ink)">Upgrade</h1>
        <p className="mt-2 text-sm text-(--ink)/70">
          Enter the site password to manage the dashboard, gallery, announcements,
          documents, and more.
        </p>
        <label className="mt-6 block text-sm font-medium text-(--ink)">
          Password
          <input
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="mt-2 w-full rounded-lg border border-(--ink)/15 bg-white px-3 py-2.5 text-base text-(--ink) outline-none focus:border-(--orange)"
          />
        </label>
        {loginStatus.type === "error" && (
          <p className="mt-3 text-sm text-red-700" role="alert">
            {loginStatus.message}
          </p>
        )}
        <button
          type="submit"
          className="hero-cta-btn mt-6 inline-flex min-h-11 w-full cursor-pointer items-center justify-center px-6 text-sm font-semibold text-black"
        >
          Continue
        </button>
      </form>
    );
  }

  if (activeTool === "dashboard") {
    return (
      <div className="dash-page">
        <DashboardWorkspace
          onBack={backToHub}
          onHome={goHome}
          onLogout={logout}
        />
      </div>
    );
  }

  return (
    <div
      className="mx-auto max-w-4xl px-5 pb-8 sm:px-6 sm:pb-10"
      style={{ paddingTop: "max(2rem, calc(1.25rem + var(--safe-top)))" }}
    >
      {!activeTool ? (
        <>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="text-3xl font-semibold text-(--ink)">Upgrade</h1>
              <p className="mt-2 max-w-xl text-sm text-(--ink)/70">
                Choose a tool to manage site content.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={goHome}
                className="inline-flex min-h-11 cursor-pointer items-center justify-center rounded-lg border border-(--ink)/20 bg-white/80 px-4 text-sm font-medium text-(--ink) transition hover:bg-white"
              >
                Home
              </button>
              <button
                type="button"
                onClick={logout}
                className="inline-flex min-h-11 cursor-pointer items-center justify-center rounded-lg border border-(--ink)/20 px-4 text-sm font-medium text-(--ink)"
              >
                Log out
              </button>
            </div>
          </div>

          <div className="mt-8">
            <LayoutGroup id="upgrade">
              <UpgradeChooser onSelectTool={openTool} />
            </LayoutGroup>
          </div>
        </>
      ) : activeTool === "gallery" ? (
        <UpgradeGalleryEditor
          data={galleryData}
          savedData={savedGalleryData}
          setData={setGalleryData}
          saving={gallerySaving}
          status={galleryStatus}
          setStatus={setGalleryStatus}
          onSave={saveGallery}
          onBack={backToHub}
          onHome={goHome}
          onLogout={logout}
        />
      ) : activeTool === "announcement" ? (
        <UpgradeAnnouncementEditor
          data={galleryData}
          savedData={savedGalleryData}
          setData={setGalleryData}
          saving={gallerySaving}
          status={galleryStatus}
          onSave={saveGallery}
          onBack={backToHub}
          onHome={goHome}
          onLogout={logout}
        />
      ) : activeTool === "documents" ? (
        <UpgradeDocumentsEditor
          data={documentsData}
          savedData={savedDocumentsData}
          setData={setDocumentsData}
          saving={documentsSaving}
          status={documentsStatus}
          setStatus={setDocumentsStatus}
          onSave={saveDocuments}
          onBack={backToHub}
          onHome={goHome}
          onLogout={logout}
        />
      ) : activeTool === "popup" ? (
        <UpgradePopupEditor
          data={popupData}
          savedData={savedPopupData}
          setData={setPopupData}
          saving={popupSaving}
          status={popupStatus}
          setStatus={setPopupStatus}
          onSave={savePopup}
          onBack={backToHub}
          onHome={goHome}
          onLogout={logout}
        />
      ) : null}
    </div>
  );
}

export function UpgradePageContent(props: UpgradePageContentProps) {
  return (
    <Suspense
      fallback={
        <p className="mx-auto max-w-md px-5 py-16 text-center text-(--ink)/70">
          Loading…
        </p>
      }
    >
      <UpgradePageContentInner {...props} />
    </Suspense>
  );
}
