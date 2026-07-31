"use client";

import { useEffect, useId, useRef, useState } from "react";

const SCRIPT_ID = "google-recaptcha-v2";

type Grecaptcha = {
  render: (
    container: HTMLElement,
    parameters: {
      sitekey: string;
      callback?: (token: string) => void;
      "expired-callback"?: () => void;
      "error-callback"?: () => void;
      theme?: "light" | "dark";
      size?: "normal" | "compact";
    },
  ) => number;
  reset: (widgetId?: number) => void;
};

declare global {
  interface Window {
    grecaptcha?: Grecaptcha;
    __asoscRecaptchaV2Ready?: Promise<Grecaptcha>;
  }
}

function loadRecaptchaApi(): Promise<Grecaptcha> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("reCAPTCHA unavailable."));
  }
  if (window.grecaptcha?.render) {
    return Promise.resolve(window.grecaptcha);
  }
  if (window.__asoscRecaptchaV2Ready) {
    return window.__asoscRecaptchaV2Ready;
  }

  window.__asoscRecaptchaV2Ready = new Promise<Grecaptcha>((resolve, reject) => {
    const callbackName = "__asoscOnRecaptchaV2Load";

    Object.assign(window, {
      [callbackName]: () => {
        if (window.grecaptcha?.render) {
          resolve(window.grecaptcha);
          return;
        }
        reject(new Error("reCAPTCHA loaded but render() is missing."));
      },
    });

    const existing = document.getElementById(SCRIPT_ID) as HTMLScriptElement | null;
    if (existing) {
      existing.addEventListener(
        "error",
        () => reject(new Error("reCAPTCHA script failed to load.")),
        { once: true },
      );
      // Script may already be loaded from a prior visit.
      if (window.grecaptcha?.render) resolve(window.grecaptcha);
      return;
    }

    const script = document.createElement("script");
    script.id = SCRIPT_ID;
    script.src = `https://www.google.com/recaptcha/api.js?onload=${callbackName}&render=explicit`;
    script.async = true;
    script.defer = true;
    script.onerror = () => reject(new Error("reCAPTCHA script failed to load."));
    document.head.appendChild(script);
  });

  return window.__asoscRecaptchaV2Ready;
}

type RecaptchaFieldProps = {
  onChange: (token: string | null) => void;
  resetSignal?: number;
  className?: string;
};

export function RecaptchaField({ onChange, resetSignal = 0, className }: RecaptchaFieldProps) {
  const siteKey = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY ?? "";
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<number | null>(null);
  const onChangeRef = useRef(onChange);
  const labelId = useId();
  const [error, setError] = useState<string | null>(null);

  onChangeRef.current = onChange;

  useEffect(() => {
    if (!siteKey) {
      setError("reCAPTCHA is not configured.");
      return;
    }

    let cancelled = false;

    const mount = async () => {
      try {
        const grecaptcha = await loadRecaptchaApi();
        if (cancelled || !containerRef.current) return;

        if (widgetIdRef.current !== null) {
          grecaptcha.reset(widgetIdRef.current);
          onChangeRef.current(null);
          setError(null);
          return;
        }

        containerRef.current.innerHTML = "";
        widgetIdRef.current = grecaptcha.render(containerRef.current, {
          sitekey: siteKey,
          callback: (token) => {
            setError(null);
            onChangeRef.current(token);
          },
          "expired-callback": () => onChangeRef.current(null),
          "error-callback": () => {
            onChangeRef.current(null);
            setError("reCAPTCHA failed to load. Refresh and try again.");
          },
          theme: "light",
        });
        setError(null);
      } catch (err) {
        if (cancelled) return;
        onChangeRef.current(null);
        setError(err instanceof Error ? err.message : "reCAPTCHA failed to load.");
      }
    };

    void mount();

    return () => {
      cancelled = true;
    };
  }, [siteKey]);

  useEffect(() => {
    if (resetSignal === 0) return;
    if (widgetIdRef.current === null || !window.grecaptcha) return;
    window.grecaptcha.reset(widgetIdRef.current);
    onChangeRef.current(null);
  }, [resetSignal]);

  return (
    <div className={className}>
      <p id={labelId} className="sr-only">
        Confirm you are not a robot
      </p>
      <div ref={containerRef} aria-labelledby={labelId} style={{ minHeight: 78 }} />
      {error && (
        <p className="mt-2 text-sm font-semibold text-red-700" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
