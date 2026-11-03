"use client";

import { useEffect, useRef, useState } from "react";

type State = "working" | "done" | "resubscribed" | "error";

/**
 * Unsubscribes as soon as the page opens in a browser (link scanners in mail
 * systems usually don't run scripts, so they don't trigger it), with an undo.
 */
export function UnsubscribeClient({ email, token, kept = false }: { email: string; token: string; kept?: boolean }) {
  const [state, setState] = useState<State>(!email || !token ? "error" : kept ? "resubscribed" : "working");
  const [error, setError] = useState(email && token ? "" : "This unsubscribe link is incomplete.");
  const started = useRef(false);

  const call = async (undo: boolean) => {
    try {
      const res = await fetch("/api/unsubscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ e: email, t: token, undo }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok || data.error) throw new Error(data.error || "Something went wrong.");
      setState(undo ? "resubscribed" : "done");
      // Remember a resubscribe in the address, so reloading or reopening this page doesn't unsubscribe them again.
      const url = new URL(window.location.href);
      if (undo) url.searchParams.set("kept", "1");
      else url.searchParams.delete("kept");
      window.history.replaceState(null, "", url.toString());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
      setState("error");
    }
  };

  useEffect(() => {
    if (started.current || !email || !token || kept) return;
    started.current = true;
    void call(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="mx-auto flex max-w-md flex-col gap-4 py-16 text-center">
      {state === "working" && <p className="text-lg">Unsubscribing {email}…</p>}
      {state === "done" && (
        <>
          <h1 className="text-3xl font-bold">You&rsquo;re unsubscribed</h1>
          <p>
            <strong>{email}</strong> won&rsquo;t get ASOSC mailing-list emails any more. You&rsquo;ll still get
            confirmations for forms you fill in and payments you make.
          </p>
          <p>
            <button type="button" className="underline underline-offset-4" onClick={() => call(true)}>
              Unsubscribed by mistake? Resubscribe
            </button>
          </p>
        </>
      )}
      {state === "resubscribed" && (
        <>
          <h1 className="text-3xl font-bold">You&rsquo;re back on the list</h1>
          <p>
            <strong>{email}</strong> will get ASOSC emails again.
          </p>
          <p>
            <button type="button" className="underline underline-offset-4" onClick={() => call(false)}>
              Unsubscribe after all
            </button>
          </p>
        </>
      )}
      {state === "error" && (
        <>
          <h1 className="text-3xl font-bold">We couldn&rsquo;t unsubscribe you</h1>
          <p>{error}</p>
          <p>Reply to any ASOSC email with &ldquo;unsubscribe&rdquo; and we&rsquo;ll remove you by hand.</p>
        </>
      )}
    </div>
  );
}
