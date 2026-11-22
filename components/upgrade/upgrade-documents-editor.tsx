"use client";

import { useState } from "react";
import { ArrowDown, ArrowUp, FileText, Loader2, Pencil, Plus, Trash2, Upload } from "lucide-react";
import { createDocumentGroupId, createDocumentItemId, collectDocumentUrls } from "@/lib/documents-cms/helpers";
import type { DocumentsCmsData, DocumentsCmsGroup, DocumentsCmsItem } from "@/lib/documents-cms/types";
import { UpgradeToolHeader, type UpgradeStatus } from "@/components/upgrade/upgrade-tool-header";
import { StepWizard, WizardChoices, WizardOption, WIZARD_INPUT, type WizardStep } from "@/components/ui/step-wizard";
import { cn } from "@/lib/utils";

const ACCEPT =
  ".pdf,.docx,.pptx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.presentationml.presentation";
const ICON_BTN =
  "inline-flex size-9 cursor-pointer items-center justify-center rounded-lg border border-(--ink)/15 bg-white text-(--ink) transition hover:bg-(--cream-light) disabled:cursor-not-allowed disabled:opacity-30";

function move<T>(list: T[], from: number, to: number): T[] {
  if (to < 0 || to >= list.length) return list;
  const next = [...list];
  const [it] = next.splice(from, 1);
  next.splice(to, 0, it);
  return next;
}

/** Uploads that were never saved are removed when abandoned or replaced. */
async function deleteDraftUrls(urls: string[], saved: DocumentsCmsData) {
  const savedUrls = new Set(collectDocumentUrls(saved));
  const draft = [...new Set(urls.filter((u) => u && !savedUrls.has(u)))];
  if (!draft.length) return;
  await fetch("/api/upgrade/documents/media", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ urls: draft }),
  }).catch(() => undefined);
}

type Editing =
  | { kind: "doc"; groupId: string | null; item: DocumentsCmsItem | null }
  | { kind: "group"; group: DocumentsCmsGroup };

interface UpgradeDocumentsEditorProps {
  data: DocumentsCmsData;
  savedData: DocumentsCmsData;
  setData: React.Dispatch<React.SetStateAction<DocumentsCmsData>>;
  saving: boolean;
  status: UpgradeStatus;
  setStatus: React.Dispatch<React.SetStateAction<UpgradeStatus>>;
  onSave: (next?: DocumentsCmsData) => Promise<boolean>;
  onBack: () => void;
  onHome: () => void;
  onLogout: () => void;
}

export function UpgradeDocumentsEditor({ savedData, saving, status, setStatus, onSave, onBack, onHome, onLogout }: UpgradeDocumentsEditorProps) {
  const [editing, setEditing] = useState<Editing | null>(null);
  const groups = savedData.groups;
  const save = (next: DocumentsCmsGroup[]) => onSave({ ...savedData, groups: next });

  const open = (e: Editing) => {
    setStatus({ type: "idle", message: "" });
    setEditing(e);
  };

  if (editing?.kind === "doc") {
    return (
      <div className="mt-8">
        <DocWizard
          groups={groups}
          groupId={editing.groupId}
          item={editing.item}
          saved={savedData}
          saving={saving}
          status={status}
          setStatus={setStatus}
          onCancel={() => setEditing(null)}
          onFinish={async (next) => {
            if (await save(next)) setEditing(null);
          }}
        />
      </div>
    );
  }

  if (editing?.kind === "group") {
    return (
      <div className="mt-8">
        <GroupRename
          group={editing.group}
          saving={saving}
          status={status}
          onCancel={() => setEditing(null)}
          onFinish={async (title) => {
            if (await save(groups.map((g) => (g.id === editing.group.id ? { ...g, title } : g)))) setEditing(null);
          }}
        />
      </div>
    );
  }

  return (
    <div className="mt-8 space-y-6">
      <UpgradeToolHeader
        title="Documents"
        description="Files people can download from About Us."
        isDirty={false}
        saving={saving}
        status={status}
        onBack={onBack}
        onHome={onHome}
        onSave={() => {}}
        onLogout={onLogout}
        showSave={false}
      />

      <button
        type="button"
        onClick={() => open({ kind: "doc", groupId: null, item: null })}
        className="flex min-h-16 w-full cursor-pointer items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-(--ink)/20 text-base font-semibold text-(--ink)/75 transition hover:border-(--orange) hover:text-(--ink)"
      >
        <Plus className="size-5" aria-hidden /> Add a document
      </button>

      {groups.map((g, gi) => (
        <section key={g.id} className="rounded-2xl bg-white/70 p-4 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-semibold text-(--ink)">{g.title}</h2>
            <div className="flex items-center gap-2">
              <button type="button" className={ICON_BTN} aria-label={`Rename ${g.title}`} onClick={() => open({ kind: "group", group: g })}>
                <Pencil className="size-4" aria-hidden />
              </button>
              <button type="button" className={ICON_BTN} aria-label="Move section up" disabled={saving || gi === 0} onClick={() => void save(move(groups, gi, gi - 1))}>
                <ArrowUp className="size-4" aria-hidden />
              </button>
              <button
                type="button"
                className={ICON_BTN}
                aria-label="Move section down"
                disabled={saving || gi === groups.length - 1}
                onClick={() => void save(move(groups, gi, gi + 1))}
              >
                <ArrowDown className="size-4" aria-hidden />
              </button>
              <button
                type="button"
                className={cn(ICON_BTN, "text-red-700")}
                aria-label={`Delete ${g.title}`}
                disabled={saving}
                onClick={() => {
                  if (!confirm(`Delete "${g.title}" and its ${g.items.length} file${g.items.length === 1 ? "" : "s"}? This can't be undone.`)) return;
                  void save(groups.filter((x) => x.id !== g.id));
                }}
              >
                <Trash2 className="size-4" aria-hidden />
              </button>
            </div>
          </div>

          {g.items.length === 0 ? (
            <p className="mt-3 text-sm text-(--ink)/50">No files yet.</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {g.items.map((item, ii) => (
                <li key={item.id} className="flex items-center gap-3 rounded-xl bg-white px-3 py-2.5">
                  <FileText className="size-5 shrink-0 text-(--ink)/45" aria-hidden />
                  <a href={item.url} target="_blank" rel="noreferrer" className="min-w-0 flex-1 truncate text-sm font-medium text-(--ink) hover:underline">
                    {item.label}
                  </a>
                  <button type="button" className={ICON_BTN} aria-label={`Edit ${item.label}`} onClick={() => open({ kind: "doc", groupId: g.id, item })}>
                    <Pencil className="size-4" aria-hidden />
                  </button>
                  <button
                    type="button"
                    className={ICON_BTN}
                    aria-label="Move up"
                    disabled={saving || ii === 0}
                    onClick={() => void save(groups.map((x) => (x.id === g.id ? { ...x, items: move(x.items, ii, ii - 1) } : x)))}
                  >
                    <ArrowUp className="size-4" aria-hidden />
                  </button>
                  <button
                    type="button"
                    className={ICON_BTN}
                    aria-label="Move down"
                    disabled={saving || ii === g.items.length - 1}
                    onClick={() => void save(groups.map((x) => (x.id === g.id ? { ...x, items: move(x.items, ii, ii + 1) } : x)))}
                  >
                    <ArrowDown className="size-4" aria-hidden />
                  </button>
                  <button
                    type="button"
                    className={cn(ICON_BTN, "text-red-700")}
                    aria-label={`Delete ${item.label}`}
                    disabled={saving}
                    onClick={() => {
                      if (!confirm(`Delete "${item.label}"? This can't be undone.`)) return;
                      void save(groups.map((x) => (x.id === g.id ? { ...x, items: x.items.filter((y) => y.id !== item.id) } : x)));
                    }}
                  >
                    <Trash2 className="size-4" aria-hidden />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------- add / edit a document

function DocWizard({
  groups,
  groupId: initialGroupId,
  item,
  saved,
  saving,
  status,
  setStatus,
  onCancel,
  onFinish,
}: {
  groups: DocumentsCmsGroup[];
  groupId: string | null;
  item: DocumentsCmsItem | null;
  saved: DocumentsCmsData;
  saving: boolean;
  status: UpgradeStatus;
  setStatus: (s: UpgradeStatus) => void;
  onCancel: () => void;
  onFinish: (groups: DocumentsCmsGroup[]) => void;
}) {
  const isNew = !item;
  const [newGroupId] = useState(() => createDocumentGroupId(`section-${Date.now()}`));
  const [groupId, setGroupId] = useState<string>(initialGroupId ?? groups[0]?.id ?? newGroupId);
  const [newGroupTitle, setNewGroupTitle] = useState("");
  const [file, setFile] = useState<Omit<DocumentsCmsItem, "id" | "label"> | null>(item);
  const [label, setLabel] = useState(item?.label ?? "");
  const [uploading, setUploading] = useState(false);
  const creatingGroup = groupId === newGroupId;

  async function upload(f: File) {
    const previous = file?.url && file.url !== item?.url ? file.url : "";
    setUploading(true);
    setStatus({ type: "idle", message: "" });
    try {
      const form = new FormData();
      form.append("file", f);
      form.append("groupId", groupId);
      const res = await fetch("/api/upgrade/documents/upload", { method: "POST", body: form });
      const body = (await res.json()) as { url?: string; filename?: string; contentType?: string; error?: string };
      if (!res.ok || !body.url) {
        setStatus({ type: "error", message: body.error ?? "Upload failed" });
        return;
      }
      setFile({ url: body.url, filename: body.filename ?? f.name, contentType: body.contentType ?? "application/octet-stream" });
      if (!label.trim()) setLabel(f.name.replace(/\.[^.]+$/, ""));
      if (previous) void deleteDraftUrls([previous], saved);
    } catch {
      setStatus({ type: "error", message: "Upload failed" });
    } finally {
      setUploading(false);
    }
  }

  const steps: WizardStep[] = [];
  if (isNew) {
    steps.push({
      key: "group",
      title: "Which section is it for?",
      content: (
        <WizardChoices>
          {groups.map((g) => (
            <WizardOption key={g.id} title={g.title} selected={groupId === g.id} onSelect={() => setGroupId(g.id)} />
          ))}
          <WizardOption title="A new section" selected={creatingGroup} onSelect={() => setGroupId(newGroupId)} />
        </WizardChoices>
      ),
    });
    if (creatingGroup) {
      steps.push({
        key: "group-name",
        title: "Name the new section",
        hint: "For example “Annual Reports”.",
        ready: newGroupTitle.trim().length > 0,
        content: <input autoFocus className={WIZARD_INPUT} value={newGroupTitle} onChange={(e) => setNewGroupTitle(e.target.value)} />,
      });
    }
  }
  steps.push(
    {
      key: "file",
      title: isNew ? "Upload the file" : "Replace the file?",
      hint: isNew ? "PDF, Word or PowerPoint, up to 25 MB." : "Optional. Keep the current file or choose a new one.",
      ready: Boolean(file),
      content: (
        <label className="flex min-h-28 w-full cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-(--ink)/20 bg-white p-4 text-center transition hover:border-(--orange)">
          {uploading ? (
            <Loader2 className="size-7 animate-spin text-(--ink)/60" aria-label="Uploading" />
          ) : file ? (
            <>
              <FileText className="size-7 text-(--ink)/60" aria-hidden />
              <span className="max-w-full truncate text-base font-medium text-(--ink)">{file.filename}</span>
              <span className="text-sm text-(--ink)/55 underline">Choose a different file</span>
            </>
          ) : (
            <>
              <Upload className="size-7 text-(--ink)/60" aria-hidden />
              <span className="text-base font-medium text-(--ink)/70">Choose file</span>
            </>
          )}
          <input
            type="file"
            accept={ACCEPT}
            className="sr-only"
            disabled={uploading}
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              if (f) void upload(f);
            }}
          />
        </label>
      ),
    },
    {
      key: "label",
      title: "What should it be called on the website?",
      ready: label.trim().length > 0,
      content: <input autoFocus className={WIZARD_INPUT} value={label} onChange={(e) => setLabel(e.target.value)} />,
    },
  );

  function finish() {
    if (!file) return;
    const next: DocumentsCmsItem = { id: item?.id ?? createDocumentItemId(file.filename), label: label.trim(), ...file };
    let list = groups;
    if (creatingGroup) list = [...list, { id: newGroupId, title: newGroupTitle.trim(), items: [] }];
    onFinish(
      list.map((g) =>
        g.id !== groupId ? g : { ...g, items: item ? g.items.map((x) => (x.id === item.id ? next : x)) : [...g.items, next] },
      ),
    );
  }

  return (
    <StepWizard
      steps={steps}
      label={isNew ? "New document" : item.label}
      busy={uploading}
      onCancel={() => {
        if (file && file.url !== item?.url) void deleteDraftUrls([file.url], saved);
        onCancel();
      }}
      onFinish={finish}
      finishLabel="Save"
      finishing={saving}
      status={status.type === "error" ? status : undefined}
    />
  );
}

function GroupRename({
  group,
  saving,
  status,
  onCancel,
  onFinish,
}: {
  group: DocumentsCmsGroup;
  saving: boolean;
  status: UpgradeStatus;
  onCancel: () => void;
  onFinish: (title: string) => void;
}) {
  const [title, setTitle] = useState(group.title);
  return (
    <StepWizard
      steps={[
        {
          key: "title",
          title: "Rename this section",
          ready: title.trim().length > 0,
          content: <input autoFocus className={WIZARD_INPUT} value={title} onChange={(e) => setTitle(e.target.value)} />,
        },
      ]}
      onCancel={onCancel}
      onFinish={() => onFinish(title.trim())}
      finishLabel="Save"
      finishing={saving}
      status={status.type === "error" ? status : undefined}
    />
  );
}
