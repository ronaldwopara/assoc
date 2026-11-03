"use client";

import { useEffect, useRef, useState } from "react";
import { FileSpreadsheet, X } from "lucide-react";
import { Busy, Segmented } from "@/components/dashboard/ui";
import { parseSheetDate } from "@/lib/sheet-dates";

type Kind = "volunteer" | "event";
type Progress = {
  copied: number;
  skipped: number;
  remaining: number;
  total: number;
  waitSeconds?: number;
};
type Preview = {
  title: string;
  suggestedName: string;
  tab: string;
  responses: number;
  usable: number;
  sample: Array<{ name: string; email: string }>;
  lastResponse?: string;
  emailFound: boolean;
  alreadyAdded?: string;
};

const wait = (ms: number) => new Promise((r) => window.setTimeout(r, ms));
const LIST_NAME: Record<Kind, string> = {
  volunteer: "Volunteers",
  event: "Event registrations",
};

async function post<T>(body: Record<string, unknown>): Promise<T> {
  const res = await fetch("/api/dashboard/event-forms", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const d = (await res.json()) as T & { error?: string };
  if (!res.ok || d.error) throw new Error(d.error || "Something went wrong");
  return d;
}

function when(value?: string) {
  const d = value ? parseSheetDate(value) : null;
  return d
    ? d.toLocaleDateString("en-CA", {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : "";
}

const plural = (n: number, one: string, many = `${one}s`) =>
  `${n} ${n === 1 ? one : many}`;

/**
 * Connect a Google Form: paste its response sheet link, check what's in it,
 * then add everyone. People already in the form are added without an email;
 * anyone who fills it in afterwards is copied in each morning and gets the
 * confirmation email.
 */
export function AddFormDialog({
  kind: fixedKind,
  onClose,
  onDone,
}: {
  kind?: Kind;
  onClose: () => void;
  onDone: (message: string) => void;
}) {
  const [link, setLink] = useState("");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [name, setName] = useState("");
  const [kind, setKind] = useState<Kind>(fixedKind ?? "event");
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState("");
  const [progress, setProgress] = useState<{
    done: number;
    total: number;
    note?: string;
  } | null>(null);
  const linkRef = useRef<HTMLInputElement>(null);
  const working = checking || Boolean(progress);

  useEffect(() => {
    linkRef.current?.focus();
  }, []);

  // Escape closes, unless people are being added.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !progress) onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose, progress]);

  const check = async (value = link) => {
    if (!value.trim()) return;
    setChecking(true);
    setError("");
    setPreview(null);
    try {
      const { preview: p } = await post<{ preview: Preview }>({
        action: "preview",
        link: value,
      });
      setPreview(p);
      setName(p.suggestedName || p.title);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't open that sheet");
    } finally {
      setChecking(false);
    }
  };

  const add = async () => {
    if (!preview) return;
    setError("");
    setProgress({ done: 0, total: preview.usable });
    try {
      const { form } = await post<{ form: { id: string; name: string } }>({
        action: "add",
        name,
        kind,
        link,
        tab: preview.tab,
        importExisting: true,
      });
      let added = 0;
      for (let failures = 0; ;) {
        let p: Progress;
        try {
          ({ progress: p } = await post<{ progress: Progress }>({
            action: "import",
            id: form.id,
          }));
          failures = 0;
        } catch (e) {
          // Google limits how fast the sheet can be read; wait and carry on where it stopped.
          if (++failures > 5) throw e;
          setProgress(
            (x) =>
              x && {
                ...x,
                note: "Google needs a moment. Carrying on shortly…",
              },
          );
          await wait(30_000);
          continue;
        }
        added += p.copied;
        setProgress({
          done: p.total - p.remaining,
          total: p.total,
          note: p.waitSeconds
            ? "Google needs a moment. Carrying on shortly…"
            : undefined,
        });
        if (!p.remaining) break;
        if (p.waitSeconds) await wait(p.waitSeconds * 1000);
      }
      onDone(
        `${form.name} is connected. ${plural(added, "person", "people")} added to ${LIST_NAME[kind]}.`,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
      setProgress(null);
    }
  };

  const ready = Boolean(
    preview && !preview.alreadyAdded && preview.emailFound && name.trim(),
  );
  const pct =
    progress && progress.total
      ? Math.round((progress.done / progress.total) * 100)
      : 0;

  return (
    <div className="dash-modal-backdrop" onClick={() => !progress && onClose()}>
      <div
        className="dash-modal dash-modal--narrow dash-addform"
        role="dialog"
        aria-modal="true"
        aria-labelledby="addform-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="dash-modal-head">
          <div>
            <h3 id="addform-title" className="dash-emails-section-title">
              Connect a Google Form
            </h3>
            <p className="dash-section-lead">
              {fixedKind
                ? `Everyone who fills it in shows up in ${LIST_NAME[fixedKind]}.`
                : "Everyone who fills it in shows up in Volunteers or Event registrations."}
            </p>
          </div>
          <button
            type="button"
            className="dash-addform-close focus-ring-light"
            onClick={onClose}
            disabled={Boolean(progress)}
            aria-label="Close"
          >
            <X size={18} aria-hidden />
          </button>
        </div>

        <div className="dash-addform-body">
          {progress ? (
            <div className="dash-progress" role="status">
              <p className="dash-addform-progress-title">
                Adding {plural(progress.total, "person", "people")} to{" "}
                {LIST_NAME[kind]}…
              </p>
              <div className="dash-progress-bar">
                <span style={{ width: `${pct}%` }} />
              </div>
              <p className="dash-field-hint">
                {progress.note ||
                  `${progress.done} of ${progress.total}. Keep this open until it finishes.`}
              </p>
            </div>
          ) : (
            <>
              {!preview && (
                <form
                  id="addform-link-form"
                  className="dash-addform-link"
                  onSubmit={(e) => {
                    e.preventDefault();
                    void check();
                  }}
                >
                  <label htmlFor="addform-link" className="dash-field-label">
                    Link to the form&rsquo;s response sheet
                  </label>
                  <input
                    ref={linkRef}
                    id="addform-link"
                    className="dash-input"
                    value={link}
                    onChange={(e) => {
                      setLink(e.target.value);
                      setPreview(null);
                      setError("");
                    }}
                    onPaste={(e) => {
                      const pasted = e.clipboardData.getData("text");
                      if (pasted)
                        window.setTimeout(() => void check(pasted), 0);
                    }}
                    placeholder="https://docs.google.com/spreadsheets/d/…"
                    autoComplete="off"
                    spellCheck={false}
                  />
                  <p className="dash-field-hint">
                    In the form, open <strong>Responses</strong> →{" "}
                    <strong>Link to Sheets</strong>, share the sheet with
                    support@asosc.ca, and paste its link here.
                  </p>
                </form>
              )}

              {error && <p className="dash-error">{error}</p>}

              {preview && (
                <div className="dash-addform-found">
                  <div className="dash-addform-card">
                    <div className="dash-addform-sheet">
                      <FileSpreadsheet size={20} aria-hidden />
                      <div className="dash-addform-sheet-text">
                        <p className="dash-addform-sheet-title">
                          {preview.title || "Response sheet"}
                        </p>
                        <p className="dash-addform-sheet-meta">
                          {plural(preview.responses, "response")}
                          {preview.lastResponse
                            ? ` · latest ${when(preview.lastResponse)}`
                            : ""}
                        </p>
                      </div>
                      <button
                        type="button"
                        className="dash-text-btn focus-ring-light"
                        onClick={() => {
                          setPreview(null);
                          setLink("");
                          window.setTimeout(() => linkRef.current?.focus(), 0);
                        }}
                      >
                        Change
                      </button>
                    </div>
                    {!preview.alreadyAdded &&
                      preview.emailFound &&
                      preview.sample.length > 0 && (
                        <ul
                          className="dash-addform-people"
                          aria-label="Latest responses"
                        >
                          {preview.sample.map((p) => (
                            <li key={p.email}>
                              <strong>{p.name}</strong>
                              <span>{p.email}</span>
                            </li>
                          ))}
                          {preview.usable > preview.sample.length && (
                            <li className="dash-addform-more">
                              and {preview.usable - preview.sample.length} more
                            </li>
                          )}
                        </ul>
                      )}
                  </div>

                  {preview.alreadyAdded ? (
                    <p className="dash-notice dash-notice--plain">
                      This form is already connected as{" "}
                      <strong>{preview.alreadyAdded}</strong>. Its new responses
                      are already being added.
                    </p>
                  ) : !preview.emailFound ? (
                    <p className="dash-error">
                      This form doesn&rsquo;t ask for an email address, so its
                      people can&rsquo;t be added. Add an email question to the
                      form first.
                    </p>
                  ) : (
                    <>
                      <div className="dash-field">
                        <label
                          htmlFor="addform-name"
                          className="dash-field-label"
                        >
                          Show it as
                        </label>
                        <input
                          id="addform-name"
                          className="dash-input"
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                        />
                        <p className="dash-field-hint">
                          In the From column and in Send email.
                        </p>
                      </div>

                      {!fixedKind && (
                        <div className="dash-field">
                          <span className="dash-field-label">People are</span>
                          <Segmented
                            label="People are"
                            value={kind}
                            onChange={setKind}
                            options={[
                              { value: "event", label: "Coming to an event" },
                              { value: "volunteer", label: "Volunteering" },
                            ]}
                          />
                        </div>
                      )}

                      <p className="dash-addform-note">
                        {preview.usable
                          ? `They’re added now without an email. Anyone who fills it in later gets the confirmation email.`
                          : "Nobody has filled it in yet. Anyone who does gets the confirmation email."}
                      </p>
                    </>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {!progress && (
          <div className="dash-addform-foot">
            <button
              type="button"
              className="dash-text-btn focus-ring-light"
              onClick={onClose}
            >
              Cancel
            </button>
            {preview ? (
              <button
                type="button"
                className="dash-primary-btn focus-ring-light"
                onClick={add}
                disabled={!ready || working}
              >
                {preview.usable
                  ? `Add ${plural(preview.usable, "person", "people")}`
                  : "Connect form"}
              </button>
            ) : (
              <button
                type="submit"
                form="addform-link-form"
                className="dash-primary-btn focus-ring-light"
                disabled={!link.trim() || checking}
              >
                <Busy busy={checking}>Continue</Busy>
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
