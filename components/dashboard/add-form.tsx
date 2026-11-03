"use client";

import { useState } from "react";
import { Busy, Segmented } from "@/components/dashboard/ui";
import { EmailField } from "@/components/dashboard/email-editor";

type Kind = "volunteer" | "event";
type Progress = { copied: number; skipped: number; remaining: number; total: number; waitSeconds?: number };

const wait = (ms: number) => new Promise((r) => window.setTimeout(r, ms));

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

/**
 * Link a Google Form's response sheet so its responses land in Volunteers or
 * Event registrations (and the Master List). Optionally copies in everyone who
 * already filled it in, without emailing them; new responses after that are
 * copied every morning and get the confirmation email.
 */
export function AddFormFields({ kind: fixedKind, onDone, onCancel }: { kind?: Kind; onDone: (message: string) => void; onCancel: () => void }) {
  const [name, setName] = useState("");
  const [kind, setKind] = useState<Kind>(fixedKind ?? "event");
  const [link, setLink] = useState("");
  const [existing, setExisting] = useState<"copy" | "skip">("copy");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");

  const listName = kind === "volunteer" ? "Volunteers" : "Event registrations";

  const add = async () => {
    setBusy(true);
    setError("");
    setStatus("Checking the spreadsheet…");
    try {
      const { form } = await post<{ form: { id: string; name: string } }>({
        action: "add",
        name,
        kind,
        link,
        importExisting: existing === "copy",
      });
      if (existing === "skip") {
        onDone(`${form.name} added. New responses will be copied into ${listName} every morning.`);
        return;
      }
      let copied = 0;
      for (let failures = 0; ; ) {
        let progress: Progress;
        try {
          ({ progress } = await post<{ progress: Progress }>({ action: "import", id: form.id }));
          failures = 0;
        } catch (e) {
          // A busy moment on Google's side: wait and pick up where it left off.
          if (++failures > 5) throw e;
          setStatus("Google needs a moment. Carrying on shortly…");
          await wait(30_000);
          continue;
        }
        copied += progress.copied;
        if (!progress.remaining) break;
        setStatus(`Copied ${progress.total - progress.remaining} of ${progress.total}…${progress.waitSeconds ? " Pausing for Google's limit." : ""}`);
        if (progress.waitSeconds) await wait(progress.waitSeconds * 1000);
      }
      onDone(
        `${form.name} added. ${copied} ${copied === 1 ? "person" : "people"} copied into ${listName} (no emails sent). New responses will be copied every morning.`,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
      setStatus("");
      setBusy(false);
    }
  };

  return (
    <div className="dash-subcard-form">
      <EmailField
        id="add-form-name"
        label={kind === "volunteer" ? "What they're volunteering for" : "Event name"}
        value={name}
        onChange={setName}
        placeholder={kind === "volunteer" ? "African Festival 2027" : "Family Wellness Day 2027"}
        hint="Shown as “From” on the list and in Send email."
      />
      {!fixedKind && (
        <div className="dash-field">
          <span className="dash-field-label">What the form is for</span>
          <Segmented
            label="What the form is for"
            value={kind}
            onChange={setKind}
            options={[
              { value: "event", label: "Registering to attend" },
              { value: "volunteer", label: "Volunteering" },
            ]}
          />
        </div>
      )}
      <EmailField
        id="add-form-link"
        label="Link to the form's response spreadsheet"
        value={link}
        onChange={setLink}
        placeholder="https://docs.google.com/spreadsheets/d/…"
        hint="In the Google Form, open Responses, then Link to Sheets. Share that sheet with support@asosc.ca or africanssocietyofsc@gmail.com (Viewer is enough)."
      />
      <div className="dash-field">
        <span className="dash-field-label">People who already filled it in</span>
        <Segmented
          label="People who already filled it in"
          value={existing}
          onChange={setExisting}
          options={[
            { value: "copy", label: "Copy them in (no emails)" },
            { value: "skip", label: "Only new responses" },
          ]}
        />
      </div>
      {error && <p className="dash-error">{error}</p>}
      <div className="dash-savebar dash-savebar--inline">
        <button type="button" className="dash-primary-btn focus-ring-light" onClick={add} disabled={busy || !name.trim() || !link.trim()}>
          <Busy busy={busy}>Add form</Busy>
        </button>
        <button type="button" className="dash-text-btn focus-ring-light" onClick={onCancel} disabled={busy}>
          Cancel
        </button>
      </div>
      {status && <p className="dash-savebar-status">{status}</p>}
    </div>
  );
}
