"use client";

import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, FileText, Trash2 } from "lucide-react";
import {
  createDocumentGroupId,
  createDocumentItemId,
  collectDocumentUrls,
} from "@/lib/documents-cms/helpers";
import type {
  DocumentsCmsData,
  DocumentsCmsGroup,
  DocumentsCmsItem,
} from "@/lib/documents-cms/types";
import {
  UpgradeToolHeader,
  useUpgradeDirtyGuard,
  type UpgradeStatus,
} from "@/components/upgrade/upgrade-tool-header";

function emptyGroup(): DocumentsCmsGroup {
  const title = "New Group";
  return {
    id: createDocumentGroupId(title),
    title,
    items: [],
  };
}

function moveItem<T>(items: T[], from: number, to: number): T[] {
  if (to < 0 || to >= items.length) return items;
  const next = [...items];
  const [removed] = next.splice(from, 1);
  next.splice(to, 0, removed);
  return next;
}

/** Drop draft Cloudinary uploads that were never published in saved CMS. */
function collectDraftDocumentUrls(urls: string[], saved: DocumentsCmsData): string[] {
  const savedUrls = new Set(collectDocumentUrls(saved));
  return [...new Set(urls.filter((url) => url && !savedUrls.has(url)))];
}

async function deleteDraftDocumentUrls(urls: string[], saved: DocumentsCmsData) {
  const draftUrls = collectDraftDocumentUrls(urls, saved);
  if (draftUrls.length === 0) return;
  try {
    await fetch("/api/upgrade/documents/media", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ urls: draftUrls }),
    });
  } catch {
    // Save-time cleanup is the safety net for published assets.
  }
}

interface UpgradeDocumentsEditorProps {
  data: DocumentsCmsData;
  savedData: DocumentsCmsData;
  setData: React.Dispatch<React.SetStateAction<DocumentsCmsData>>;
  saving: boolean;
  status: UpgradeStatus;
  setStatus: React.Dispatch<React.SetStateAction<UpgradeStatus>>;
  onSave: () => void;
  onBack: () => void;
  onHome: () => void;
  onLogout: () => void;
}

export function UpgradeDocumentsEditor({
  data,
  savedData,
  setData,
  saving,
  status,
  setStatus,
  onSave,
  onBack,
  onHome,
  onLogout,
}: UpgradeDocumentsEditorProps) {
  const [groupIndex, setGroupIndex] = useState(0);
  const [uploadingItemId, setUploadingItemId] = useState<string | null>(null);

  const group = data.groups[groupIndex] ?? null;

  const isDirty = useMemo(
    () => JSON.stringify(data) !== JSON.stringify(savedData),
    [data, savedData],
  );
  useUpgradeDirtyGuard(isDirty);

  const updateGroup = (updater: (group: DocumentsCmsGroup) => DocumentsCmsGroup) => {
    setData((prev) => ({
      ...prev,
      groups: prev.groups.map((item, index) =>
        index === groupIndex ? updater(item) : item,
      ),
    }));
  };

  const uploadDocument = async (
    file: File,
    options: { itemId?: string; label?: string; isNew?: boolean } = {},
  ) => {
    if (!group) return;
    const itemId = options.itemId ?? createDocumentItemId(file.name);
    const previousUrl = options.itemId
      ? (group.items.find((item) => item.id === options.itemId)?.url ?? "")
      : "";
    setUploadingItemId(options.isNew ? "new" : itemId);
    setStatus({ type: "idle", message: "" });
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("groupId", group.id);
      const res = await fetch("/api/upgrade/documents/upload", {
        method: "POST",
        body: form,
      });
      const body = (await res.json()) as {
        url?: string;
        filename?: string;
        contentType?: string;
        error?: string;
      };
      if (!res.ok || !body.url) {
        setStatus({ type: "error", message: body.error ?? "Upload failed" });
        return;
      }

      const nextItem: DocumentsCmsItem = {
        id: itemId,
        label: options.label ?? file.name.replace(/\.[^.]+$/, ""),
        url: body.url,
        filename: body.filename ?? file.name,
        contentType: body.contentType ?? "application/octet-stream",
      };

      updateGroup((current) => {
        const existingIndex = current.items.findIndex((item) => item.id === itemId);
        if (existingIndex === -1) {
          return { ...current, items: [...current.items, nextItem] };
        }
        const items = [...current.items];
        items[existingIndex] = { ...items[existingIndex], ...nextItem };
        return { ...current, items };
      });

      // Replacing an unsaved draft upload — remove the old Cloudinary asset now.
      if (previousUrl) {
        void deleteDraftDocumentUrls([previousUrl], savedData);
      }

      setStatus({
        type: "ok",
        message: options.itemId
          ? "Document replaced. Click Save to publish."
          : "Document uploaded. Click Save to publish.",
      });
    } catch {
      setStatus({ type: "error", message: "Upload failed" });
    } finally {
      setUploadingItemId(null);
    }
  };

  return (
    <div className="mt-8 space-y-6">
      <UpgradeToolHeader
        title="Documents"
        description="Manage About Us downloads — financial reports, bylaws, and plans. Upload, replace, or remove files, then Save to publish. Removed Cloudinary files are deleted on Save."
        isDirty={isDirty}
        saving={saving}
        status={status}
        onBack={onBack}
        onHome={onHome}
        onSave={onSave}
        onLogout={onLogout}
      />

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          className="rounded-lg border border-(--ink)/20 bg-white px-3 py-2 text-sm font-medium text-(--ink)"
          onClick={() => {
            setData((prev) => ({
              ...prev,
              groups: [...prev.groups, emptyGroup()],
            }));
            setGroupIndex(data.groups.length);
          }}
        >
          Add group
        </button>
        {group && (
          <button
            type="button"
            className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-800"
            onClick={() => {
              if (!confirm(`Delete group “${group.title}”?`)) return;
              const removedUrls = group.items.map((item) => item.url);
              setData((prev) => ({
                ...prev,
                groups: prev.groups.filter((_, index) => index !== groupIndex),
              }));
              setGroupIndex(0);
              void deleteDraftDocumentUrls(removedUrls, savedData);
            }}
          >
            Delete group
          </button>
        )}
      </div>

      {data.groups.length === 0 ? (
        <p className="text-(--ink)/70">No groups yet. Add one to get started.</p>
      ) : (
        <>
          <div className="flex flex-wrap gap-2">
            {data.groups.map((item, index) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setGroupIndex(index)}
                className="rounded-full px-3 py-1.5 text-sm font-medium"
                style={{
                  background:
                    index === groupIndex ? "var(--orange)" : "rgba(47,43,40,0.08)",
                  color: index === groupIndex ? "#111" : "var(--ink)",
                }}
              >
                {item.title}
              </button>
            ))}
          </div>

          {group && (
            <div className="space-y-6 rounded-2xl bg-white/70 p-5 sm:p-6">
              <label className="block text-sm font-medium text-(--ink)">
                Group title
                <input
                  value={group.title}
                  onChange={(event) =>
                    updateGroup((current) => ({
                      ...current,
                      title: event.target.value,
                    }))
                  }
                  className="mt-2 w-full rounded-lg border border-(--ink)/15 bg-white px-3 py-2.5 text-base outline-none focus:border-(--orange)"
                />
              </label>

              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-sm font-medium text-(--ink)">Documents</h2>
                <label className="inline-flex cursor-pointer items-center justify-center rounded-lg bg-(--orange) px-4 py-2 text-sm font-semibold text-black">
                  {uploadingItemId === "new" ? "Uploading…" : "Upload new"}
                  <input
                    type="file"
                    accept=".pdf,.docx,.pptx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.presentationml.presentation"
                    className="sr-only"
                    disabled={uploadingItemId !== null}
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      event.target.value = "";
                      if (file) void uploadDocument(file, { isNew: true });
                    }}
                  />
                </label>
              </div>

              {group.items.length === 0 ? (
                <p className="text-sm text-(--ink)/60">
                  No documents in this group yet. Upload a PDF, DOCX, or PPTX (max 25MB).
                </p>
              ) : (
                <ul className="space-y-3">
                  {group.items.map((item, itemIndex) => (
                    <li
                      key={item.id}
                      className="rounded-xl border border-(--ink)/10 bg-(--cream-light) p-4"
                    >
                      <div className="flex flex-wrap items-start gap-3">
                        <FileText className="mt-1 h-5 w-5 shrink-0 text-(--ink)/50" aria-hidden />
                        <div className="min-w-0 flex-1 space-y-3">
                          <label className="block text-sm font-medium text-(--ink)">
                            Display label
                            <input
                              value={item.label}
                              onChange={(event) =>
                                updateGroup((current) => ({
                                  ...current,
                                  items: current.items.map((entry) =>
                                    entry.id === item.id
                                      ? { ...entry, label: event.target.value }
                                      : entry,
                                  ),
                                }))
                              }
                              className="mt-2 w-full rounded-lg border border-(--ink)/15 bg-white px-3 py-2.5 text-base outline-none focus:border-(--orange)"
                            />
                          </label>
                          <p className="truncate text-xs text-(--ink)/55">{item.filename}</p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            className="rounded-lg border border-(--ink)/20 px-2.5 py-2 text-sm"
                            aria-label="Move up"
                            disabled={itemIndex === 0}
                            onClick={() =>
                              updateGroup((current) => ({
                                ...current,
                                items: moveItem(current.items, itemIndex, itemIndex - 1),
                              }))
                            }
                          >
                            <ArrowUp className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            className="rounded-lg border border-(--ink)/20 px-2.5 py-2 text-sm"
                            aria-label="Move down"
                            disabled={itemIndex === group.items.length - 1}
                            onClick={() =>
                              updateGroup((current) => ({
                                ...current,
                                items: moveItem(current.items, itemIndex, itemIndex + 1),
                              }))
                            }
                          >
                            <ArrowDown className="h-4 w-4" />
                          </button>
                          <label className="inline-flex cursor-pointer items-center justify-center rounded-lg border border-(--ink)/20 px-3 py-2 text-sm font-medium">
                            {uploadingItemId === item.id ? "Uploading…" : "Replace"}
                            <input
                              type="file"
                              accept=".pdf,.docx,.pptx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.presentationml.presentation"
                              className="sr-only"
                              disabled={uploadingItemId !== null}
                              onChange={(event) => {
                                const file = event.target.files?.[0];
                                event.target.value = "";
                                if (file) {
                                  void uploadDocument(file, {
                                    itemId: item.id,
                                    label: item.label,
                                  });
                                }
                              }}
                            />
                          </label>
                          <button
                            type="button"
                            className="inline-flex items-center gap-1 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-800"
                            onClick={() => {
                              if (!confirm(`Delete “${item.label}”?`)) return;
                              const removedUrl = item.url;
                              updateGroup((current) => ({
                                ...current,
                                items: current.items.filter((entry) => entry.id !== item.id),
                              }));
                              void deleteDraftDocumentUrls([removedUrl], savedData);
                            }}
                          >
                            <Trash2 className="h-4 w-4" aria-hidden />
                            Delete
                          </button>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
