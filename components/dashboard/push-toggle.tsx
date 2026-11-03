"use client";

import { useEffect, useState } from "react";
import { Busy } from "@/components/dashboard/ui";

type State = "loading" | "unsupported" | "ios-install" | "not-set-up" | "blocked" | "off" | "on";

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

function deviceName(): string {
  const ua = navigator.userAgent;
  const os = /iPhone|iPad/.test(ua) ? "iPhone/iPad" : /Android/.test(ua) ? "Android" : /Mac/.test(ua) ? "Mac" : /Windows/.test(ua) ? "Windows" : "Computer";
  const browser = /Edg\//.test(ua) ? "Edge" : /Chrome\//.test(ua) ? "Chrome" : /Firefox\//.test(ua) ? "Firefox" : /Safari\//.test(ua) ? "Safari" : "Browser";
  return `${browser} on ${os}`;
}

/** "Get a notification on this device when a form comes in": turn on, test, turn off. */
export function PushToggle() {
  const [state, setState] = useState<State>("loading");
  const [publicKey, setPublicKey] = useState("");
  const [endpoint, setEndpoint] = useState("");
  const [busy, setBusy] = useState("");
  const [status, setStatus] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const ios = /iPhone|iPad|iPod/.test(navigator.userAgent);
      const installed = window.matchMedia("(display-mode: standalone)").matches;
      if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
        if (!cancelled) setState(ios && !installed ? "ios-install" : "unsupported");
        return;
      }
      const res = await fetch("/api/dashboard/push", { cache: "no-store" }).catch(() => null);
      const d = res?.ok ? ((await res.json()) as { publicKey?: string | null }) : null;
      if (!d?.publicKey) {
        if (!cancelled) setState("not-set-up");
        return;
      }
      const reg = await navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" });
      const sub = await reg.pushManager.getSubscription();
      if (cancelled) return;
      setPublicKey(d.publicKey);
      if (Notification.permission === "denied") setState("blocked");
      else if (sub) {
        setEndpoint(sub.endpoint);
        setState("on");
      } else setState("off");
    })().catch(() => !cancelled && setState("unsupported"));
    return () => {
      cancelled = true;
    };
  }, []);

  const turnOn = async () => {
    setBusy("on");
    setStatus("");
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setState(permission === "denied" ? "blocked" : "off");
        return;
      }
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey) as BufferSource,
      });
      const res = await fetch("/api/dashboard/push", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subscription: sub.toJSON(), device: deviceName() }),
      });
      if (!res.ok) throw new Error(((await res.json()) as { error?: string }).error || "Couldn't turn on");
      setEndpoint(sub.endpoint);
      setState("on");
      setStatus("On. You'll get a notification on this device whenever a form comes in.");
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Couldn't turn on");
    } finally {
      setBusy("");
    }
  };

  const turnOff = async () => {
    setBusy("off");
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      await sub?.unsubscribe();
      await fetch("/api/dashboard/push", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endpoint }),
      });
      setState("off");
      setStatus("Off for this device.");
    } finally {
      setBusy("");
    }
  };

  const test = async () => {
    setBusy("test");
    setStatus("");
    try {
      const res = await fetch("/api/dashboard/push", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ test: endpoint }),
      });
      const d = (await res.json()) as { ok?: boolean };
      setStatus(d.ok ? "Test sent. It should pop up in a few seconds." : "The test didn't go through. Try turning notifications off and on again.");
    } finally {
      setBusy("");
    }
  };

  if (state === "loading") return null;

  const text: Record<Exclude<State, "loading">, string> = {
    unsupported: "This browser can't show notifications. Try Chrome, Edge, Firefox or Safari.",
    "ios-install": "To get notifications on an iPhone, open this page in Safari, tap Share, then Add to Home Screen, and open the dashboard from there.",
    "not-set-up": "Notifications need one setup step before they can be turned on (the keys in Vercel).",
    blocked: "Notifications are blocked for this site in your browser settings. Allow them there, then reload.",
    off: "Get a notification on this device whenever a form comes in.",
    on: "Notifications are on for this device.",
  };

  return (
    <div className={state === "on" ? "dash-notice dash-notice--on" : "dash-notice"}>
      <span>{status || text[state]}</span>
      <span className="dash-row-buttons">
        {state === "off" && (
          <button type="button" className="dash-primary-btn focus-ring-light" onClick={turnOn} disabled={Boolean(busy)}>
            <Busy busy={busy === "on"}>Turn on notifications</Busy>
          </button>
        )}
        {state === "on" && (
          <>
            <button type="button" className="dash-action-btn focus-ring-light" onClick={test} disabled={Boolean(busy)}>
              <Busy busy={busy === "test"}>Send a test</Busy>
            </button>
            <button type="button" className="dash-text-btn focus-ring-light" onClick={turnOff} disabled={Boolean(busy)}>
              Turn off
            </button>
          </>
        )}
      </span>
    </div>
  );
}
