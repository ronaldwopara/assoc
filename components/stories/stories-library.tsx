"use client";

import { useCallback, useEffect, useId, useRef, useState, useSyncExternalStore, type FormEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Loader2, Play, X } from "lucide-react";
import { guidedFieldInputClassName } from "@/components/guided-form";
import { LICENCE_TIERS, STORIES, type LicenceTerm, type LicenceTier, type Story } from "@/lib/licences/catalogue";
import { cn } from "@/lib/utils";

type Session = { signedIn: boolean; email?: string; active?: boolean; tier?: string | null; accessUntil?: string | null };
type View = "trailer" | "buy" | "sign-in" | "player";

const EASE = [0.16, 1, 0.3, 1] as const;
const noopSubscribe = () => () => {};

/* Same square buttons as the rest of the site (hero, events, volunteer). */
const PRIMARY_BTN =
  "hero-cta-btn focus-ring-light inline-flex min-h-12 w-full cursor-pointer items-center justify-center gap-2 px-8 py-3 text-base font-semibold tracking-wide text-black transition duration-200 ease-out disabled:cursor-not-allowed disabled:opacity-40";
const QUIET_BTN =
  "focus-ring-light inline-flex cursor-pointer items-center justify-center text-sm font-medium text-black/60 underline decoration-black/20 underline-offset-2 transition-colors hover:text-black/80 hover:decoration-black/40";
const BACK_BTN =
  "focus-ring-light inline-flex min-h-10 cursor-pointer items-center justify-center rounded-xl px-3 text-sm font-semibold text-black/75 transition-colors hover:bg-(--brown-dark)/5";

/** A ref that always holds the latest value, so effects can call a callback without re-running. */
function useLatest<T>(value: T) {
  const ref = useRef(value);
  useEffect(() => {
    ref.current = value;
  });
  return ref;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const money = (n: number) => `$${n.toLocaleString("en-CA")}`;


// ---------------------------------------------------------------- page section

/** The library holds one film for now; the page is built around it. */
const FILM = STORIES[0];

export function StoriesLibrary({ notice }: { notice?: "signed-in" | "expired" }) {
  const [session, setSession] = useState<Session>({ signedIn: false });
  // An expired emailed link drops the reader straight into the sign-in step.
  const [view, setView] = useState<View | null>(() => (notice === "expired" ? "sign-in" : null));
  const [justSignedIn, setJustSignedIn] = useState(notice === "signed-in");
  const [more, setMore] = useState(false);
  const reduce = useReducedMotion();

  const refreshSession = useCallback(
    () =>
      fetch("/api/licence/session", { cache: "no-store" })
        .then((res) => res.json() as Promise<Session>)
        .then(setSession, () => setSession({ signedIn: false })),
    [],
  );

  useEffect(() => {
    let live = true;
    fetch("/api/licence/session", { cache: "no-store" })
      .then((res) => res.json() as Promise<Session>)
      .then(
        (s) => live && setSession(s),
        () => live && setSession({ signedIn: false }),
      );
    return () => {
      live = false;
    };
  }, []);

  // Tidy ?library=… out of the address bar once it has been read.
  useEffect(() => {
    if (notice) window.history.replaceState(null, "", window.location.pathname);
  }, [notice]);

  const licensed = Boolean(session.signedIn && session.active);

  async function signOut() {
    await fetch("/api/licence/sign-out", { method: "POST" });
    setJustSignedIn(false);
    await refreshSession();
  }

  return (
    <section aria-labelledby="stories-heading" className="mx-auto w-full max-w-6xl lg:flex lg:min-h-[calc(100dvh-var(--header-height)-var(--announcement-bar-height,0px)-7.5rem)] lg:flex-col lg:justify-center">
      <AnimatePresence initial={false}>
        {session.signedIn && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="mx-auto mb-8 flex max-w-xl items-center justify-between gap-3 rounded-full border border-(--brown-dark)/10 bg-white px-4 py-2 text-sm text-black/70"
            role="status"
          >
            <span className="min-w-0 truncate">
              {licensed
                ? `${justSignedIn ? "You're signed in. " : ""}${session.email}`
                : `${session.email} has no active licence`}
            </span>
            <button type="button" onClick={signOut} className={QUIET_BTN}>
              Sign out
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.div
        initial={reduce ? false : { opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: EASE }}
        className="grid items-center gap-8 lg:grid-cols-[1.25fr_1fr] lg:gap-14"
      >
        {/* The cover already carries the title art, so nothing sits on top of it. */}
        <button
          type="button"
          onClick={() => setView(licensed ? "player" : FILM.trailerId ? "trailer" : "buy")}
          className="group focus-ring-light relative block aspect-3/2 w-full overflow-hidden rounded-2xl bg-(--cream) shadow-xl shadow-black/15"
          aria-label={licensed ? `Watch ${FILM.title}` : `Watch the ${FILM.title} trailer`}
        >
          <Image
            src={FILM.cover}
            alt=""
            fill
            priority
            sizes="(min-width: 1024px) 640px, 100vw"
            className="object-cover transition-transform duration-700 ease-out group-hover:scale-[1.015]"
          />
          <span className="absolute inset-0 bg-black/0 transition-colors duration-300 group-hover:bg-black/10" />
          <span className="absolute inset-0 grid place-items-center">
            <span className="grid size-14 place-items-center rounded-full bg-white/95 text-(--ink) shadow-xl shadow-black/30 transition-transform duration-300 ease-out group-hover:scale-110 sm:size-20">
              <Play className="ml-1 size-5 fill-current sm:size-7" aria-hidden />
            </span>
          </span>
          {!licensed && FILM.trailerId && (
            <span className="absolute right-3 top-3 bg-(--hero-cta) px-3 py-1 text-xs font-bold uppercase tracking-wider text-black shadow-md sm:right-4 sm:top-4">
              Trailer
            </span>
          )}
        </button>

        <div className="mx-auto max-w-xl text-center lg:w-fit lg:text-left">
          <h1 id="stories-heading" className="text-[1.75rem] font-bold leading-tight tracking-tight text-balance text-(--ink) sm:whitespace-nowrap sm:text-4xl lg:text-[clamp(2rem,2.9vw,2.75rem)]">
            {FILM.title}
          </h1>
          <p className="mt-3 text-base text-pretty text-black/70 sm:text-lg lg:max-w-md">
            {FILM.summary}{" "}
            {!more && (
              <button type="button" onClick={() => setMore(true)} aria-expanded={more} className={QUIET_BTN}>
                Read more
              </button>
            )}
          </p>
          <AnimatePresence initial={false}>
            {more && (
              <motion.p
                key="more"
                initial={reduce ? { opacity: 0 } : { opacity: 0, height: 0 }}
                animate={reduce ? { opacity: 1 } : { opacity: 1, height: "auto" }}
                exit={reduce ? { opacity: 0 } : { opacity: 0, height: 0 }}
                transition={{ duration: 0.24, ease: EASE }}
                className="overflow-hidden text-base leading-relaxed text-pretty text-black/60 lg:max-w-md"
              >
                <span className="block pt-3">
                  {FILM.hook}{" "}
                  <button
                    type="button"
                    onClick={() => setMore(false)}
                    aria-expanded={more}
                    className="focus-ring-light cursor-pointer align-baseline text-black/60 underline decoration-black/25 underline-offset-2 transition-colors hover:text-black/80"
                  >
                    Show less
                  </button>
                </span>
              </motion.p>
            )}
          </AnimatePresence>

          <div className="mx-auto mt-8 max-w-xs lg:max-w-none">
            {licensed ? (
              <button type="button" onClick={() => setView("player")} className={PRIMARY_BTN}>
                Watch the film
              </button>
            ) : (
              <button type="button" onClick={() => setView("buy")} className={PRIMARY_BTN}>
                Get access
              </button>
            )}
          </div>
          {!licensed && (
            <p className="mx-auto mt-3 max-w-xs text-center text-sm text-black/50 lg:max-w-none">
              From {money(LICENCE_TIERS[0].prices.month ?? 0)}/month ·{" "}
              <button
                type="button"
                onClick={() => setView("sign-in")}
                className="focus-ring-light cursor-pointer align-baseline text-black/50 underline decoration-black/25 underline-offset-2 transition-colors hover:text-black/80"
              >
                Sign in
              </button>
            </p>
          )}
        </div>
      </motion.div>

      <StoryModal
        state={view ? { story: FILM, view } : null}
        session={session}
        onView={setView}
        onClose={() => setView(null)}
      />
    </section>
  );
}

// ---------------------------------------------------------------- modal shell

function StoryModal({
  state,
  session,
  onView,
  onClose,
}: {
  state: { story: Story; view: View } | null;
  session: Session;
  onView: (v: View) => void;
  onClose: () => void;
}) {
  // True only in the browser, so the portal never renders during SSR.
  const mounted = useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const open = Boolean(state);
  const closeRef = useLatest(onClose);

  // Scroll lock (iOS-safe), Escape, focus in and back out, and a Tab trap.
  useEffect(() => {
    if (!open) return;
    const trigger = document.activeElement as HTMLElement | null;
    const html = document.documentElement;
    const body = document.body;
    const y = window.scrollY;
    const saved = { body: body.style.cssText, html: html.style.overflow };
    html.style.overflow = "hidden";
    Object.assign(body.style, { position: "fixed", top: `-${y}px`, left: "0", right: "0", width: "100%" });

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeRef.current();
      if (e.key !== "Tab" || !dialogRef.current) return;
      const items = dialogRef.current.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), iframe, [tabindex]:not([tabindex="-1"])',
      );
      if (!items.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    const frame = requestAnimationFrame(() =>
      dialogRef.current?.focus({ preventScroll: true }),
    );

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("keydown", onKey);
      body.style.cssText = saved.body;
      html.style.overflow = saved.html;
      window.scrollTo(0, y);
      trigger?.focus?.({ preventScroll: true });
    };
  }, [open, closeRef]);

  if (!mounted) return null;

  const video = state?.view === "player" || state?.view === "trailer";

  return createPortal(
    <AnimatePresence>
      {state && (
        <motion.div
          key="veil"
          className="fixed inset-0 z-100 flex items-end justify-center sm:items-center sm:p-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          <div className="absolute inset-0 bg-black/55 backdrop-blur-[2px]" onClick={onClose} aria-hidden />
          <motion.div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            tabIndex={-1}
            aria-labelledby={titleId}
            initial={reduce ? { opacity: 0, maxWidth: video ? 896 : 460 } : { opacity: 0, y: 32, scale: 0.98, maxWidth: video ? 896 : 460 }}
            animate={{ opacity: 1, y: 0, scale: 1, maxWidth: video ? 896 : 460 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, y: 20, scale: 0.98 }}
            transition={{ type: "spring", stiffness: 420, damping: 36, mass: 0.8 }}
            className={cn(
              "relative z-10 flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-2xl outline-none shadow-[0_24px_48px_rgba(0,0,0,0.28)] sm:rounded-2xl",
              video ? "bg-black" : "bg-(--cream-light)",
            )}
          >
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className={cn(
                "focus-ring-light absolute z-20 grid cursor-pointer place-items-center rounded-full transition",
                video
                  ? "right-3 top-3 size-9 bg-black/45 text-white shadow-sm backdrop-blur hover:bg-black/65"
                  : "right-4 top-4 size-8 text-black/55 hover:bg-black/5 hover:text-black sm:right-5 sm:top-5",
              )}
            >
              <X className="size-4" aria-hidden />
            </button>
            <div className="overflow-y-auto overscroll-contain">
              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  key={state.view}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.15 }}
                >
                  {state.view === "trailer" && (
                    <Player story={state.story} trailer titleId={titleId} onDone={onClose} />
                  )}
                  {state.view === "player" && (
                    <Player
                      story={state.story}
                      titleId={titleId}
                      onDone={onClose}
                      onNeedSignIn={() => onView("sign-in")}
                    />
                  )}
                  {state.view === "buy" && (
                    <BuyFlow titleId={titleId} defaultEmail={session.email} />
                  )}
                  {state.view === "sign-in" && <SignIn titleId={titleId} />}
                </motion.div>
              </AnimatePresence>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

// ---------------------------------------------------------------- 1. getting a licence

type Audience = "me" | "org";

/**
 * One question per screen, like the Join form:
 *   1. Who is it for?        (just me / a school or organization)
 *   2. Billing or size       (monthly vs yearly, or how many people)
 *   3. Where to send access  (email, summary, pay)
 * Choices move on by themselves; only the last step has a button.
 */
function BuyFlow({ titleId, defaultEmail }: { titleId: string; defaultEmail?: string }) {
  const reduce = useReducedMotion();
  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState(1);
  const [audience, setAudience] = useState<Audience | null>(null);
  const [choice, setChoice] = useState<{ tier: LicenceTier; term: LicenceTerm } | null>(null);
  const [email, setEmail] = useState(defaultEmail ?? "");
  const [leaving, setLeaving] = useState(false);
  const TOTAL = 3;

  const go = (to: number) => {
    setDirection(to > step ? 1 : -1);
    setStep(to);
  };

  const individual = LICENCE_TIERS.find((t) => t.id === "individual")!;
  const orgTiers = LICENCE_TIERS.filter((t) => t.id !== "individual" && t.id !== "extended");

  function pay(e: FormEvent) {
    e.preventDefault();
    const link = choice?.tier.links[choice.term];
    if (!link || !EMAIL_RE.test(email.trim())) return;
    const clean = email.trim().toLowerCase();
    // Saved so we can remind them if they don't finish paying. keepalive lets it finish after we leave the page.
    fetch("/api/licence/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: clean, tier: choice.tier.id, term: choice.term }),
      keepalive: true,
    }).catch(() => {});
    const url = new URL(link);
    url.searchParams.set("prefilled_email", clean);
    // Comes back on the webhook, so paying stops reminders even if they change the email at Stripe.
    const ref = btoa(String.fromCharCode(...new TextEncoder().encode(clean)));
    url.searchParams.set("client_reference_id", ref.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""));
    setLeaving(true);
    window.location.assign(url.toString());
  }

  const slide = reduce
    ? { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 } }
    : {
        initial: { opacity: 0, x: direction * 28 },
        animate: { opacity: 1, x: 0 },
        exit: { opacity: 0, x: direction * -28 },
      };

  return (
    <div className="px-5 pb-7 pt-6 sm:px-8 sm:pb-8 sm:pt-7">
      <div>
        <p className="mb-3 pr-12 text-sm font-semibold tracking-wide text-black/55" aria-live="polite">
          Step {step + 1} of {TOTAL}
        </p>
        <div
          className="h-1 overflow-hidden rounded-full bg-(--brown-dark)/10"
          role="progressbar"
          aria-valuemin={1}
          aria-valuemax={TOTAL}
          aria-valuenow={step + 1}
          aria-label="Progress"
        >
          <div
            className="h-full rounded-full bg-(--hero-cta) transition-[width] duration-300 ease-out"
            style={{ width: `${((step + 1) / TOTAL) * 100}%` }}
          />
        </div>
      </div>

      <div className="relative -mx-1.5 overflow-hidden px-1.5 pb-1.5 pt-5">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div key={step} {...slide} transition={{ duration: 0.24, ease: EASE }}>
            {step === 0 && (
              <Question titleId={titleId} title="Who is this for?">
                <ChoiceList>
                  <Choice
                    title="Just me"
                    price={`From ${money(individual.prices.month ?? 0)}/mo`}
                    selected={audience === "me"}
                    onSelect={() => {
                      setAudience("me");
                      go(1);
                    }}
                  />
                  <Choice
                    title="School or organization"
                    price={`From ${money(orgTiers[0].prices.year ?? 0)}/yr`}
                    selected={audience === "org"}
                    onSelect={() => {
                      setAudience("org");
                      go(1);
                    }}
                  />
                </ChoiceList>
              </Question>
            )}

            {step === 1 && audience === "me" && (
              <Question titleId={titleId} title="How would you like to pay?" helper="Renews automatically. Cancel any time.">
                <ChoiceList>
                  {(["month", "year"] as const).map((term) => {
                    const price = individual.prices[term] ?? 0;
                    const saving = term === "year" ? (individual.prices.month ?? 0) * 12 - price : 0;
                    return (
                      <Choice
                        key={term}
                        title={term === "month" ? "Monthly" : "Yearly"}
                        note={saving > 0 ? `Save ${money(saving)}` : undefined}
                        price={`${money(price)}/${term === "month" ? "mo" : "yr"}`}
                        selected={choice?.tier.id === "individual" && choice.term === term}
                        onSelect={() => {
                          setChoice({ tier: individual, term });
                          go(2);
                        }}
                      />
                    );
                  })}
                </ChoiceList>
              </Question>
            )}

            {step === 1 && audience === "org" && (
              <Question
                titleId={titleId}
                title="How many people will use it?"
                helper="Billed yearly. Covers staff and students."
              >
                <ChoiceList>
                  {orgTiers.map((tier) => (
                    <Choice
                      key={tier.id}
                      title={tier.covers.replace(/users?\b/i, "people")}
                      price={`${money(tier.prices.year ?? 0)}/yr`}
                      selected={choice?.tier.id === tier.id}
                      onSelect={() => {
                        setChoice({ tier, term: "year" });
                        go(2);
                      }}
                    />
                  ))}
                </ChoiceList>
                <p className="pt-1 text-center text-sm text-black/55">
                  Need something broader?{" "}
                  <Link href="/contact" className={QUIET_BTN}>
                    Ask for a quote
                  </Link>
                </p>
              </Question>
            )}

            {step === 2 && choice && (
              <form id="licence-pay" onSubmit={pay} noValidate className="space-y-3">
                <Question
                  titleId={titleId}
                  title="Where should we send your access?"
                  helper="We'll email your sign-in link here. You'll pay securely with Stripe."
                >
                  <ChoiceList>
                    <Choice
                      title={
                        choice.tier.id === "individual"
                          ? `Individual, ${choice.term === "month" ? "monthly" : "yearly"}`
                          : choice.tier.covers.replace(/users?\b/i, "people")
                      }
                      price={`${money(choice.tier.prices[choice.term] ?? 0)}/${choice.term === "month" ? "mo" : "yr"}`}
                      selected
                      onSelect={() => go(1)}
                    />
                  </ChoiceList>
                  <div className="h-1" aria-hidden />
                  <label htmlFor="licence-email" className="sr-only">
                    Email
                  </label>
                  <input
                    id="licence-email"
                    type="text"
                    inputMode="email"
                    autoCapitalize="none"
                    spellCheck={false}
                    autoComplete="email"
                    placeholder="you@school.ca"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className={cn(guidedFieldInputClassName, "py-3")}
                  />
                </Question>
              </form>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {step > 0 && (
        <div className="flex items-center gap-2 pt-5">
          <button type="button" onClick={() => go(step - 1)} className={cn(BACK_BTN, "-ml-3")}>
            Back
          </button>
          {step === 2 && (
            <button type="submit" form="licence-pay" disabled={leaving || !EMAIL_RE.test(email.trim())} className={cn(PRIMARY_BTN, "ml-auto w-auto")}>
              {leaving && <Loader2 className="size-4 animate-spin" aria-hidden />}
              Continue to payment
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function Question({ titleId, title, helper, children }: { titleId: string; title: string; helper?: string; children: ReactNode }) {
  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <h2 id={titleId} className="text-lg font-bold text-balance text-black sm:text-xl">
          {title}
        </h2>
        {helper && <p className="text-sm text-pretty text-black/55">{helper}</p>}
      </div>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

/** Same option rows as the Join forms (OptionRow in components/guided-form.tsx). */
function ChoiceList({ children }: { children: ReactNode }) {
  return (
    <div role="radiogroup" className="guided-fields space-y-2">
      {children}
    </div>
  );
}

function Choice({
  title,
  note,
  price,
  selected,
  onSelect,
}: {
  title: string;
  /** Optional short tag after the title, e.g. "Save $90". */
  note?: string;
  price: string;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      className={cn(
        "guided-option focus-ring-light box-border w-full max-w-full cursor-pointer rounded-xl border px-3 py-3 text-left text-sm font-medium sm:px-3.5 sm:text-[0.9375rem] transition-colors duration-150",
        selected
          ? "border-(--hero-cta) bg-(--hero-cta)/15 text-(--orange-dark)"
          : "border-(--brown-dark)/15 bg-white text-black hover:bg-(--brown-dark)/5",
      )}
    >
      <span className="flex items-center gap-2.5">
        <span
          className={cn(
            "flex size-5 shrink-0 items-center justify-center rounded-full border-2",
            selected ? "border-(--hero-cta) bg-(--hero-cta)" : "border-(--brown-dark)/30 bg-white",
          )}
          aria-hidden
        >
          {selected && <span className="size-1.5 rounded-full bg-black" />}
        </span>
        <span className="min-w-0 flex-1">
          {title}
          {note && <span className="ml-2 text-sm font-semibold text-(--orange-dark)">{note}</span>}
        </span>
        <span className="shrink-0 text-[0.8125rem] font-semibold text-black/60 sm:text-sm">{price}</span>
      </span>
    </button>
  );
}

// ---------------------------------------------------------------- 2. signing in

function SignIn({ titleId }: { titleId: string }) {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<{ kind: "idle" | "sending" | "sent" | "error"; message?: string }>({ kind: "idle" });

  async function submit(e: FormEvent) {
    e.preventDefault();
    setState({ kind: "sending" });
    try {
      const res = await fetch("/api/licence/sign-in", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
      const data = (await res.json()) as { message?: string; error?: string };
      setState(res.ok ? { kind: "sent", message: data.message } : { kind: "error", message: data.error });
    } catch {
      setState({ kind: "error", message: "Something went wrong. Please try again." });
    }
  }

  return (
    <div className="px-5 pb-7 pt-6 sm:px-8 sm:pb-8 sm:pt-7">
      <AnimatePresence mode="wait" initial={false}>
        {state.kind === "sent" ? (
          <motion.div key="sent" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="space-y-2 pr-8">
            <h2 id={titleId} className="text-lg font-bold text-black sm:text-xl">
              Check your email
            </h2>
            <p className="text-sm text-pretty text-black/65" role="status">
              {state.message}
            </p>
          </motion.div>
        ) : (
          <motion.form key="form" onSubmit={submit} noValidate exit={{ opacity: 0 }} className="space-y-2.5">
            <div className="space-y-1 pr-8">
              <h2 id={titleId} className="text-lg font-bold text-black sm:text-xl">
                Sign in
              </h2>
              <p className="text-sm text-pretty text-black/55">
                Enter the email your licence is under and we&rsquo;ll send you a sign-in link.
              </p>
            </div>
            <label htmlFor="signin-email" className="sr-only">
              Email
            </label>
            <input
              id="signin-email"
              type="text"
              inputMode="email"
              autoCapitalize="none"
              spellCheck={false}
              autoComplete="email"
              placeholder="you@school.ca"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={guidedFieldInputClassName}
            />
            {state.kind === "error" && (
              <p className="text-sm font-semibold text-red-700" role="alert">
                {state.message}
              </p>
            )}
            <button type="submit" disabled={state.kind === "sending"} className={cn(PRIMARY_BTN, "mt-1.5")}>
              {state.kind === "sending" && <Loader2 className="size-4 animate-spin" aria-hidden />}
              Email me a link
            </button>
          </motion.form>
        )}
      </AnimatePresence>
    </div>
  );
}

// ---------------------------------------------------------------- video

function Player({
  story,
  trailer,
  titleId,
  onDone,
  onNeedSignIn,
}: {
  story: Story;
  trailer?: boolean;
  titleId: string;
  onDone: () => void;
  onNeedSignIn?: () => void;
}) {
  const [src, setSrc] = useState("");
  const [problem, setProblem] = useState("");
  const doneRef = useLatest(onDone);
  const needSignInRef = useLatest(onNeedSignIn);

  useEffect(() => {
    let live = true;
    fetch(`/api/licence/watch?story=${story.id}${trailer ? "&trailer=1" : ""}`, { cache: "no-store" })
      .then(async (res) => {
        const data = (await res.json().catch(() => ({}))) as { url?: string; error?: string; message?: string };
        if (!live) return;
        if (data.url) return setSrc(data.url);
        if (trailer) return doneRef.current(); // no trailer → close
        if (data.error === "sign-in" || data.error === "no-licence") return needSignInRef.current?.();
        setProblem(data.message || "This film isn't available to watch yet. Please check back soon.");
      })
      .catch(() => live && setProblem("We couldn't load the video. Please try again."));
    return () => {
      live = false;
    };
  }, [story.id, trailer, doneRef, needSignInRef]);

  // Bunny's player.js reports "ended"; a finished trailer closes.
  useEffect(() => {
    if (!trailer || !src) return;
    const onMessage = (e: MessageEvent) => {
      if (e.origin !== "https://iframe.mediadelivery.net") return;
      let d = e.data;
      if (typeof d === "string") {
        try {
          d = JSON.parse(d);
        } catch {
          return;
        }
      }
      if (d?.context === "player.js" && d?.event === "ready") {
        (e.source as Window | null)?.postMessage(
          JSON.stringify({ context: "player.js", version: "0.0.10", method: "addEventListener", value: "ended" }),
          e.origin,
        );
      }
      if (d?.context === "player.js" && d?.event === "ended") doneRef.current();
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [trailer, src, doneRef]);

  return (
    <div>
      <div className="relative aspect-video w-full">
        {src ? (
          <iframe
            src={src}
            title={`${trailer ? "Trailer: " : ""}${story.title}`}
            allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
            allowFullScreen
            className="absolute inset-0 size-full border-0"
          />
        ) : (
          <div className="absolute inset-0 grid place-items-center p-6 text-center text-sm text-white/75">
            {problem ? <p className="max-w-xs">{problem}</p> : <Loader2 className="size-7 animate-spin" aria-label="Loading" />}
          </div>
        )}
      </div>
      <h2 id={titleId} className="sr-only">
        {trailer ? `Trailer: ${story.title}` : story.title}
      </h2>
    </div>
  );
}
