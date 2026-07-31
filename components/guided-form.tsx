"use client";

import {
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ChevronDown, Copy } from "lucide-react";
import { isFormDraftDirty } from "@/lib/join-community-drafts";
import {
  E_TRANSFER_EMAIL,
  getPaymentDisplayAmount,
  getStripeCheckoutUrl,
} from "@/lib/payment-links";
import { verifyRecaptchaToken } from "@/lib/recaptcha";
import { RecaptchaField } from "@/components/recaptcha-field";

export const guidedFieldInputClassName =
  "guided-field focus-ring-light box-border w-full max-w-full rounded-xl border border-(--brown-dark)/15 bg-white px-3.5 py-2.5 text-black placeholder:text-black/40 focus:outline-none";
export const guidedFieldTextareaClassName = `${guidedFieldInputClassName} resize-none`;

export type FormValue = string | string[];
export type FormValues = Record<string, FormValue>;

export type ChoiceOption = string | { value: string; label: string };

function choiceValue(option: ChoiceOption): string {
  return typeof option === "string" ? option : option.value;
}

function choiceLabel(option: ChoiceOption): string {
  return typeof option === "string" ? option : option.label;
}

export type PricedSelectOption = {
  value: string;
  title: string;
  price: string;
  label?: string;
};

export type GuidedField =
  | {
      type: "name";
      firstNameKey?: string;
      lastNameKey?: string;
    }
  | {
      type: "text";
      name: string;
      placeholder?: string;
      inputType?: string;
      autoComplete?: string;
      rows?: never;
    }
  | {
      type: "textarea";
      name: string;
      placeholder?: string;
      rows?: number;
      optional?: boolean;
    }
  | {
      type: "select";
      name: string;
      options: ChoiceOption[];
      placeholder?: string;
    }
  | {
      type: "priced-select";
      name: string;
      options: PricedSelectOption[];
      placeholder?: string;
    }
  | {
      type: "choice";
      name: string;
      options: ChoiceOption[];
      multiple?: boolean;
      /** When selected, clears every other option (e.g. "None of the above"). */
      exclusiveOption?: string;
      columns?: 1 | 2 | 3;
    }
  | {
      type: "choice-with-other";
      name: string;
      otherName: string;
      options: string[];
      otherTrigger: string;
      otherPlaceholder?: string;
      multiple?: boolean;
    }
  | {
      type: "donation-amount";
      amounts: number[];
      amountKey?: string;
      customKey?: string;
    }
  | {
      type: "payment";
      kind: "donate" | "membership";
    }
  | {
      type: "note";
      paragraphs: string[];
    };

export type GuidedStep = {
  id: string;
  title: string;
  helper?: string;
  when?: (values: FormValues) => boolean;
  validate?: (values: FormValues) => string | null;
  fields: GuidedField[];
};

type GuidedFormProps = {
  formKey: string;
  steps: GuidedStep[];
  initialValues?: FormValues;
  /** Compared for dirty detection. Defaults to initialValues when omitted. */
  baselineValues?: FormValues;
  initialStepIndex?: number;
  /** Form-level tip shown with an info icon under each question. */
  info?: string;
  submitLabel: string;
  successMessage: string;
  onSubmit: (values: FormValues) => void | Promise<void>;
  onDirtyChange?: (dirty: boolean, source: "hydrate" | "edit") => void;
  onDraftChange?: (
    draft: { values: FormValues; stepIndex: number },
    source: "hydrate" | "edit",
  ) => void;
  onCompleted?: () => void;
  onSuccessChange?: (success: boolean, values?: FormValues) => void;
};

function asString(value: FormValue | undefined): string {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

function asStringArray(value: FormValue | undefined): string[] {
  if (Array.isArray(value)) return value;
  if (!value) return [];
  return [value];
}

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export function defaultValidate(step: GuidedStep, values: FormValues): string | null {
  if (step.validate) return step.validate(values);

  for (const field of step.fields) {
    if (field.type === "note" || field.type === "payment") continue;

    if (field.type === "name") {
      const first = asString(values[field.firstNameKey ?? "firstName"]).trim();
      const last = asString(values[field.lastNameKey ?? "lastName"]).trim();
      if (!first || !last) return "Please enter your first and last name.";
      continue;
    }

    if (field.type === "donation-amount") {
      const amountKey = field.amountKey ?? "donationAmount";
      const customKey = field.customKey ?? "customAmount";
      const amount = asString(values[amountKey]);
      if (amount === "custom") {
        const custom = Number(asString(values[customKey]));
        if (!Number.isFinite(custom) || custom < 1) return "Enter a valid donation amount.";
      } else if (!amount) {
        return "Please select a donation amount.";
      }
      continue;
    }

    if (field.type === "choice" || field.type === "choice-with-other") {
      const selected = field.multiple
        ? asStringArray(values[field.name])
        : asString(values[field.name]);
      const empty = field.multiple ? selected.length === 0 : !selected;
      if (empty) return "Please make a selection.";

      if (field.type === "choice-with-other") {
        const trigger = field.otherTrigger;
        const hit = field.multiple
          ? (selected as string[]).includes(trigger)
          : selected === trigger;
        if (hit && !asString(values[field.otherName]).trim()) {
          return "Please specify.";
        }
      }
      continue;
    }

    if (
      field.type === "text" ||
      field.type === "textarea" ||
      field.type === "select" ||
      field.type === "priced-select"
    ) {
      const value = asString(values[field.name]).trim();
      if (!value) {
        if (field.type === "textarea" && field.optional) continue;
        return "This field is required.";
      }
      if (field.type === "text" && field.inputType === "email" && !isValidEmail(value)) {
        return "Please enter a valid email address.";
      }
    }
  }

  return null;
}

function OptionRow({
  selected,
  onSelect,
  children,
  multiple = false,
}: {
  selected: boolean;
  onSelect: () => void;
  children: ReactNode;
  multiple?: boolean;
}) {
  return (
    <button
      type="button"
      role={multiple ? "checkbox" : "radio"}
      aria-checked={selected}
      onClick={onSelect}
      className={`guided-option focus-ring-light box-border w-full max-w-full rounded-xl border px-3 py-2 text-left text-sm font-medium transition-colors duration-150 ${
        selected
          ? "border-(--hero-cta) bg-(--hero-cta)/15 text-(--orange-dark)"
          : "border-(--brown-dark)/15 bg-white text-black hover:bg-(--brown-dark)/5"
      }`}
    >
      <span className="flex items-start gap-2.5">
        <span
          className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center border-2 ${
            multiple ? "rounded-md" : "rounded-full"
          } ${selected ? "border-(--hero-cta) bg-(--hero-cta)" : "border-(--brown-dark)/30 bg-white"}`}
          aria-hidden="true"
        >
          {selected && (
            <svg viewBox="0 0 12 12" className="h-3 w-3 text-black" fill="none" stroke="currentColor" strokeWidth="2.5">
              {multiple ? (
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.5 6.5l2.5 2.5 4.5-5" />
              ) : (
                <circle cx="6" cy="6" r="2.25" fill="currentColor" stroke="none" />
              )}
            </svg>
          )}
        </span>
        <span>{children}</span>
      </span>
    </button>
  );
}

function PricedSelectField({
  field,
  value,
  onChange,
}: {
  field: Extract<GuidedField, { type: "priced-select" }>;
  value: string;
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState<{
    top: number;
    bottom: number;
    left: number;
    width: number;
  } | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const reduceMotion = useReducedMotion();
  const selected = field.options.find((option) => option.value === value);

  useLayoutEffect(() => {
    if (!open || !rootRef.current) {
      setCoords(null);
      return;
    }

    const update = () => {
      const rect = rootRef.current?.getBoundingClientRect();
      if (!rect) return;
      setCoords({
        top: rect.top,
        bottom: rect.bottom,
        left: rect.left,
        width: rect.width,
      });
    };

    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;

    const handlePointerDown = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      if (rootRef.current?.contains(target) || popoverRef.current?.contains(target)) return;
      setOpen(false);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("touchstart", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("touchstart", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="guided-priced-select">
      <button
        type="button"
        className="guided-priced-select__trigger focus-ring-light"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        {selected ? (
          <>
            <span className="guided-priced-select__value">{selected.title}</span>
            <span className="guided-priced-select__price">{selected.price}</span>
          </>
        ) : (
          <span className="guided-priced-select__value guided-priced-select__value--placeholder">
            {field.placeholder ?? "Select a category"}
          </span>
        )}
        <span className="guided-priced-select__caret" aria-hidden="true">
          <ChevronDown
            className={`guided-priced-select__caret-icon ${open ? "is-open" : ""}`}
          />
        </span>
      </button>

      {typeof document !== "undefined" &&
        createPortal(
          <AnimatePresence>
            {open && coords && (
              <motion.div
                ref={popoverRef}
                className="guided-priced-select__popover"
                role="listbox"
                aria-label="Membership categories"
                style={{
                  left: coords.left,
                  minWidth: Math.min(coords.width, 220),
                  maxWidth: coords.width,
                  top: `calc(${coords.bottom}px + 0.4rem)`,
                }}
                initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -8 }}
                transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
              >
                {field.options.map((option) => {
                  const isSelected = option.value === value;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      role="option"
                      aria-selected={isSelected}
                      className={`guided-priced-select__option focus-ring-light ${
                        isSelected ? "is-selected" : ""
                      }`}
                      onClick={() => {
                        onChange(option.value);
                        setOpen(false);
                      }}
                    >
                      <span className="guided-priced-select__option-title">{option.title}</span>
                      <span className="guided-priced-select__option-price">{option.price}</span>
                    </button>
                  );
                })}
              </motion.div>
            )}
          </AnimatePresence>,
          document.body,
        )}
    </div>
  );
}

function renderField(
  field: GuidedField,
  values: FormValues,
  setValue: (key: string, value: FormValue) => void,
) {
  if (field.type === "name") {
    const firstKey = field.firstNameKey ?? "firstName";
    const lastKey = field.lastNameKey ?? "lastName";
    return (
      <div className="grid grid-cols-2 gap-2.5">
        <label className="block text-left">
          <span className="mb-1.5 block text-xs font-semibold text-black/70">First</span>
          <input
            type="text"
            name={firstKey}
            placeholder="First"
            autoComplete="given-name"
            value={asString(values[firstKey])}
            onChange={(event) => setValue(firstKey, event.target.value)}
            className={guidedFieldInputClassName}
          />
        </label>
        <label className="block text-left">
          <span className="mb-1.5 block text-xs font-semibold text-black/70">Last</span>
          <input
            type="text"
            name={lastKey}
            placeholder="Last"
            autoComplete="family-name"
            value={asString(values[lastKey])}
            onChange={(event) => setValue(lastKey, event.target.value)}
            className={guidedFieldInputClassName}
          />
        </label>
      </div>
    );
  }

  if (field.type === "text") {
    return (
      <input
        type={field.inputType ?? "text"}
        name={field.name}
        placeholder={field.placeholder}
        autoComplete={field.autoComplete}
        value={asString(values[field.name])}
        onChange={(event) => setValue(field.name, event.target.value)}
        className={guidedFieldInputClassName}
      />
    );
  }

  if (field.type === "textarea") {
    return (
      <textarea
        name={field.name}
        placeholder={field.placeholder}
        rows={field.rows ?? 4}
        value={asString(values[field.name])}
        onChange={(event) => setValue(field.name, event.target.value)}
        className={guidedFieldTextareaClassName}
      />
    );
  }

  if (field.type === "select") {
    return (
      <select
        name={field.name}
        value={asString(values[field.name])}
        onChange={(event) => setValue(field.name, event.target.value)}
        className={guidedFieldInputClassName}
      >
        <option value="" disabled>
          {field.placeholder ?? "--- Select Choice ---"}
        </option>
        {field.options.map((option) => {
          const value = choiceValue(option);
          return (
            <option key={value} value={value}>
              {choiceLabel(option)}
            </option>
          );
        })}
      </select>
    );
  }

  if (field.type === "priced-select") {
    return (
      <PricedSelectField
        field={field}
        value={asString(values[field.name])}
        onChange={(next) => setValue(field.name, next)}
      />
    );
  }

  if (field.type === "choice") {
    const multiple = Boolean(field.multiple);
    const selected = multiple ? asStringArray(values[field.name]) : asString(values[field.name]);
    const gridClass =
      field.columns === 3
        ? "grid grid-cols-3 gap-2"
        : field.columns === 2
          ? "grid grid-cols-2 gap-2"
          : "space-y-2";

    return (
      <div className={gridClass} role={multiple ? "group" : "radiogroup"}>
        {field.options.map((option) => {
          const value = choiceValue(option);
          const isSelected = multiple
            ? (selected as string[]).includes(value)
            : selected === value;

          return (
            <OptionRow
              key={value}
              selected={isSelected}
              multiple={multiple}
              onSelect={() => {
                if (multiple) {
                  const current = asStringArray(values[field.name]);
                  let next: string[];
                  if (field.exclusiveOption && value === field.exclusiveOption) {
                    next = isSelected ? [] : [value];
                  } else if (field.exclusiveOption) {
                    const withoutExclusive = current.filter((item) => item !== field.exclusiveOption);
                    next = isSelected
                      ? withoutExclusive.filter((item) => item !== value)
                      : [...withoutExclusive, value];
                  } else {
                    next = isSelected
                      ? current.filter((item) => item !== value)
                      : [...current, value];
                  }
                  setValue(field.name, next);
                } else {
                  setValue(field.name, value);
                }
              }}
            >
              {choiceLabel(option)}
            </OptionRow>
          );
        })}
      </div>
    );
  }

  if (field.type === "choice-with-other") {
    const multiple = Boolean(field.multiple);
    const selected = multiple ? asStringArray(values[field.name]) : asString(values[field.name]);
    const showOther = multiple
      ? (selected as string[]).includes(field.otherTrigger)
      : selected === field.otherTrigger;

    return (
      <div className="space-y-2">
        <div className="space-y-2" role={multiple ? "group" : "radiogroup"}>
          {field.options.map((option) => {
            const isSelected = multiple
              ? (selected as string[]).includes(option)
              : selected === option;
            return (
              <OptionRow
                key={option}
                selected={isSelected}
                multiple={multiple}
                onSelect={() => {
                  if (multiple) {
                    const current = asStringArray(values[field.name]);
                    const next = isSelected
                      ? current.filter((item) => item !== option)
                      : [...current, option];
                    setValue(field.name, next);
                  } else {
                    setValue(field.name, option);
                  }
                }}
              >
                {option}
              </OptionRow>
            );
          })}
        </div>
        {showOther && (
          <input
            type="text"
            name={field.otherName}
            placeholder={field.otherPlaceholder ?? "Please specify"}
            value={asString(values[field.otherName])}
            onChange={(event) => setValue(field.otherName, event.target.value)}
            className={guidedFieldInputClassName}
          />
        )}
      </div>
    );
  }

  if (field.type === "donation-amount") {
    const amountKey = field.amountKey ?? "donationAmount";
    const customKey = field.customKey ?? "customAmount";
    const amount = asString(values[amountKey]);
    const custom = asString(values[customKey]);

    return (
      <div className="space-y-1.5">
        <div className="grid grid-cols-3 gap-1.5">
          {field.amounts.map((preset) => {
            const value = String(preset);
            const selected = amount === value;
            return (
              <button
                key={preset}
                type="button"
                onClick={() => {
                  setValue(amountKey, value);
                }}
                className={`focus-ring-light box-border rounded-lg border px-1.5 py-2 text-center text-sm font-semibold transition-colors duration-150 ${
                  selected
                    ? "border-(--hero-cta) bg-(--hero-cta)/15 text-(--orange-dark)"
                    : "border-(--brown-dark)/15 bg-white text-black hover:bg-(--brown-dark)/5"
                }`}
              >
                ${preset}
              </button>
            );
          })}
        </div>
        <div
          className={`flex min-h-10 items-center rounded-lg border px-3 py-2 transition-colors duration-150 ${
            amount === "custom"
              ? "border-(--hero-cta) bg-(--hero-cta)/15"
              : "border-(--brown-dark)/15 bg-white"
          }`}
        >
          <span className="mr-1 shrink-0 font-semibold leading-none text-black">$</span>
          <input
            type="number"
            name={customKey}
            min="1"
            placeholder="Other amount"
            value={custom}
            onChange={(event) => {
              setValue(customKey, event.target.value);
              setValue(amountKey, "custom");
            }}
            onFocus={() => setValue(amountKey, "custom")}
            className="w-full bg-transparent text-sm leading-normal text-black placeholder:text-black/40 focus:outline-none"
          />
        </div>
      </div>
    );
  }

  if (field.type === "payment") {
    return <PaymentPanel kind={field.kind} values={values} />;
  }

  if (field.type === "note") {
    return (
      <div className="space-y-2 text-left text-xs text-black/60">
        {field.paragraphs.map((paragraph) => (
          <p key={paragraph}>{paragraph}</p>
        ))}
      </div>
    );
  }

  return null;
}

function PaymentPanel({
  kind,
  values,
}: {
  kind: "donate" | "membership";
  values: FormValues;
}) {
  const [copied, setCopied] = useState(false);
  const amount = getPaymentDisplayAmount(kind, values);
  const showEtransfer = asString(values.paymentMethod) === "etransfer";

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(E_TRANSFER_EMAIL);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="guided-payment">
      <p className="guided-payment__amount">{amount}</p>
      {showEtransfer && (
        <div className="guided-payment__etransfer">
          <p className="guided-payment__etransfer-label">Send your e-transfer to</p>
          <div className="guided-payment__etransfer-row">
            <span className="guided-payment__etransfer-email">{E_TRANSFER_EMAIL}</span>
            <button
              type="button"
              onClick={() => void handleCopy()}
              className="guided-payment__copy focus-ring-light"
              aria-label={copied ? "Email copied" : "Copy e-transfer email"}
            >
              <Copy className="h-3.5 w-3.5" aria-hidden="true" />
              <span>{copied ? "Copied" : "Copy"}</span>
            </button>
          </div>
          <p className="guided-payment__etransfer-hint">
            Include your full name in the memo so we can match your payment.
          </p>
        </div>
      )}
    </div>
  );
}

export function GuidedForm({
  formKey,
  steps,
  initialValues = {},
  baselineValues,
  initialStepIndex = 0,
  info,
  submitLabel,
  successMessage,
  onSubmit,
  onDirtyChange,
  onDraftChange,
  onCompleted,
  onSuccessChange,
}: GuidedFormProps) {
  const reduceMotion = useReducedMotion();
  const headingId = useId();
  const resolvedBaseline = baselineValues ?? initialValues;
  const valuesRef = useRef<FormValues>(initialValues);
  const baselineValuesRef = useRef<FormValues>(resolvedBaseline);
  const baselineStepRef = useRef(0);
  const skipValuesReportRef = useRef(false);
  const onDirtyChangeRef = useRef(onDirtyChange);
  const onDraftChangeRef = useRef(onDraftChange);
  const onCompletedRef = useRef(onCompleted);
  const onSuccessChangeRef = useRef(onSuccessChange);

  onDirtyChangeRef.current = onDirtyChange;
  onDraftChangeRef.current = onDraftChange;
  onCompletedRef.current = onCompleted;
  onSuccessChangeRef.current = onSuccessChange;

  const [values, setValues] = useState<FormValues>(initialValues);
  const [stepIndex, setStepIndex] = useState(initialStepIndex);
  const [direction, setDirection] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "submitting" | "success" | "error">("idle");
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [captchaResetSignal, setCaptchaResetSignal] = useState(0);

  valuesRef.current = values;

  const activeSteps = useMemo(
    () => steps.filter((step) => (step.when ? step.when(values) : true)),
    [steps, values],
  );

  const safeIndex = Math.min(stepIndex, Math.max(activeSteps.length - 1, 0));
  const currentStep = activeSteps[safeIndex];
  const isFirst = safeIndex === 0;
  const isLast = safeIndex === activeSteps.length - 1;
  const isPaymentStep = Boolean(
    currentStep?.fields.find((field) => field.type === "payment")
  );
  const progress = activeSteps.length === 0 ? 0 : ((safeIndex + 1) / activeSteps.length) * 100;

  useEffect(() => {
    const nextBaseline = baselineValues ?? initialValues;
    valuesRef.current = initialValues;
    baselineValuesRef.current = nextBaseline;
    baselineStepRef.current = 0;
    skipValuesReportRef.current = true;
    setValues(initialValues);
    setStepIndex(initialStepIndex);
    setDirection(1);
    setError(null);
    setStatus("idle");
    setSubmitError(null);
    setCaptchaToken(null);
    setCaptchaResetSignal((n) => n + 1);
    const dirty = isFormDraftDirty(initialValues, initialStepIndex, nextBaseline, 0);
    onDirtyChangeRef.current?.(dirty, "hydrate");
    if (dirty) {
      onDraftChangeRef.current?.(
        { values: initialValues, stepIndex: initialStepIndex },
        "hydrate",
      );
    }
  }, [formKey]); // eslint-disable-line react-hooks/exhaustive-deps -- reset only when switching forms

  useEffect(() => {
    if (stepIndex > activeSteps.length - 1) {
      setStepIndex(Math.max(activeSteps.length - 1, 0));
    }
  }, [activeSteps.length, stepIndex]);

  useEffect(() => {
    if (status === "success") return;
    const el = document.getElementById(headingId);
    // Keep the user's scroll position — default focus() jumps to the heading
    // (and the sticky control bar) on every step/form change, especially on mobile.
    el?.focus({ preventScroll: true });
  }, [safeIndex, formKey, headingId, status]);

  useEffect(() => {
    if (status === "success") {
      onDirtyChangeRef.current?.(false, "edit");
      onCompletedRef.current?.();
      return;
    }

    if (skipValuesReportRef.current) {
      skipValuesReportRef.current = false;
      return;
    }

    const dirty = isFormDraftDirty(
      values,
      safeIndex,
      baselineValuesRef.current,
      baselineStepRef.current,
    );
    onDirtyChangeRef.current?.(dirty, "edit");
    if (dirty) {
      onDraftChangeRef.current?.({ values, stepIndex: safeIndex }, "edit");
    }
  }, [values, safeIndex, status]);

  useEffect(() => {
    onSuccessChangeRef.current?.(status === "success", valuesRef.current);
  }, [status]);

  const setValue = (key: string, value: FormValue) => {
    setValues((current) => {
      const next = { ...current, [key]: value };
      valuesRef.current = next;
      return next;
    });
    setError(null);
  };

  const goTo = (nextIndex: number, dir: number) => {
    setDirection(dir);
    setError(null);
    setStepIndex(nextIndex);
  };

  const submitValues = async (nextValues: FormValues) => {
    setStatus("submitting");
    setSubmitError(null);
    try {
      if (!captchaToken) {
        throw new Error("Please complete the reCAPTCHA.");
      }
      await verifyRecaptchaToken(captchaToken);
      await onSubmit(nextValues);
      onSuccessChangeRef.current?.(true, nextValues);
      setStatus("success");
    } catch (error) {
      setStatus("error");
      setSubmitError(
        error instanceof Error ? error.message : "Something went wrong. Please try again.",
      );
      setCaptchaToken(null);
      setCaptchaResetSignal((n) => n + 1);
      onSuccessChangeRef.current?.(false);
    }
  };

  const advanceFrom = (fromIndex: number, snapshot?: FormValues) => {
    const latest = snapshot ?? valuesRef.current;
    const visibleSteps = steps.filter((step) => (step.when ? step.when(latest) : true));
    const step = visibleSteps[fromIndex];
    if (!step) return;
    const validationError = defaultValidate(step, latest);
    if (validationError) {
      setError(validationError);
      return;
    }

    if (fromIndex >= visibleSteps.length - 1) {
      void submitValues(latest);
      return;
    }
    goTo(fromIndex + 1, 1);
  };

  const handleContinue = () => advanceFrom(safeIndex);

  const handleBack = () => {
    if (isFirst) return;
    goTo(safeIndex - 1, -1);
  };

  const handleSubmit = () => {
    if (!currentStep) return;
    advanceFrom(safeIndex);
  };

  const isSatisfied = currentStep ? defaultValidate(currentStep, values) === null : false;
  const canProceed = Boolean(
    currentStep && isSatisfied && (!isLast || Boolean(captchaToken)),
  );

  if (status === "success") {
    return null;
  }

  if (!currentStep) return null;

  const paymentField = currentStep.fields.find((field) => field.type === "payment");
  const paymentKind =
    paymentField && paymentField.type === "payment" ? paymentField.kind : "donate";
  const paymentMethod = asString(values.paymentMethod);
  const showEtransferPanel = paymentMethod === "etransfer";
  const showCardConfirm = paymentMethod === "card";
  const payVerb = paymentKind === "membership" ? "Subscribe" : "Donate";

  const handlePayCard = () => {
    if (!captchaToken) {
      setSubmitError("Please complete the reCAPTCHA.");
      return;
    }
    const url = getStripeCheckoutUrl(paymentKind, values);
    if (url) window.open(url, "_blank", "noopener,noreferrer");
    setValue("paymentMethod", "card");
  };

  const handlePayEtransfer = () => {
    if (!captchaToken) {
      setSubmitError("Please complete the reCAPTCHA.");
      return;
    }
    if (showEtransferPanel) {
      void submitValues({ ...valuesRef.current, paymentMethod: "etransfer" });
      return;
    }
    setValue("paymentMethod", "etransfer");
  };

  const handleConfirmPayment = () => {
    if (!captchaToken) {
      setSubmitError("Please complete the reCAPTCHA.");
      return;
    }
    const method = asString(values.paymentMethod);
    void submitValues({ ...valuesRef.current, paymentMethod: method });
  };

  const handleResetPaymentMethod = () => {
    setValue("paymentMethod", "");
  };

  const motionProps = reduceMotion
    ? {
        initial: { opacity: 0 },
        animate: { opacity: 1, position: "relative" as const },
        exit: { opacity: 0 },
        transition: { duration: 0.15 },
      }
    : {
        initial: { opacity: 0, x: direction > 0 ? 28 : -28 },
        animate: { opacity: 1, x: 0, position: "relative" as const },
        exit: {
          opacity: 0,
          x: direction > 0 ? -28 : 28,
          position: "absolute" as const,
          top: 0,
          left: 0,
          right: 0,
        },
        transition: { duration: 0.28, ease: [0.16, 1, 0.3, 1] as const },
      };

  const primaryButtonClassName =
    "hero-cta-btn focus-ring-light inline-flex min-h-8 items-center justify-center px-5 py-1.5 text-xs font-semibold tracking-wide text-black transition duration-200 ease-out disabled:cursor-not-allowed disabled:opacity-40 sm:min-h-9 sm:px-6 sm:text-sm";

  return (
    <div className="relative z-10 mx-auto flex w-full max-w-md flex-col overflow-x-hidden text-left">
      <div className="shrink-0">
        <div className="mb-1.5 flex items-center justify-between gap-2">
          <p className="text-xs font-semibold tracking-wide text-black/55" aria-live="polite">
            Step {safeIndex + 1} of {activeSteps.length}
          </p>
        </div>
        <div
          className="h-1 overflow-hidden rounded-full bg-(--brown-dark)/10"
          role="progressbar"
          aria-valuemin={1}
          aria-valuemax={activeSteps.length}
          aria-valuenow={safeIndex + 1}
          aria-label="Form progress"
        >
          <div
            className="h-full rounded-full bg-(--hero-cta) transition-[width] duration-300 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      <div className="relative min-h-0 overflow-hidden pt-3">
        <AnimatePresence mode="sync" custom={direction} initial={false}>
          <motion.div key={`${formKey}-${currentStep.id}`} {...motionProps} className="w-full">
            <form
              className="space-y-2.5"
              onSubmit={(event) => {
                event.preventDefault();
                if (!canProceed || status === "submitting") return;
                if (isLast) handleSubmit();
                else handleContinue();
              }}
            >
              <div className="space-y-1">
                <h2
                  id={headingId}
                  tabIndex={-1}
                  className="text-lg font-bold text-balance text-black outline-none sm:text-xl"
                >
                  {currentStep.title}
                </h2>
                {currentStep.helper && (
                  <p className="text-xs text-pretty text-black/55">
                    {currentStep.helper}
                  </p>
                )}
              </div>

              <div className="guided-fields space-y-2 px-0.5">
                {currentStep.fields.map((field, index) => (
                  <div key={`${currentStep.id}-${field.type}-${index}`}>
                    {renderField(field, values, setValue)}
                  </div>
                ))}
              </div>

              {error && (
                <p className="text-sm font-semibold text-red-700" role="alert">
                  {error}
                </p>
              )}

              <button type="submit" className="sr-only" tabIndex={-1} disabled={!canProceed}>
                {isLast ? submitLabel : "Continue"}
              </button>
            </form>
          </motion.div>
        </AnimatePresence>
      </div>

      {isLast && (
        <RecaptchaField
          onChange={setCaptchaToken}
          resetSignal={captchaResetSignal}
          className="shrink-0 pt-3"
        />
      )}

      {submitError && (
        <p className="shrink-0 pt-2 text-sm font-semibold text-red-700" role="alert">
          {submitError}
        </p>
      )}

      <div className="relative flex shrink-0 items-center gap-2 pt-3">
        {isPaymentStep ? (
          <div className="flex w-full flex-col gap-2">
            {!showCardConfirm && !showEtransferPanel && (
              <>
                <button
                  type="button"
                  onClick={handlePayCard}
                  disabled={!captchaToken || status === "submitting"}
                  className={`${primaryButtonClassName} w-full ${captchaToken && status !== "submitting" ? "cursor-pointer" : ""}`}
                >
                  {payVerb} – Card
                </button>
                <button
                  type="button"
                  onClick={handlePayEtransfer}
                  disabled={!captchaToken || status === "submitting"}
                  className={`focus-ring-light inline-flex min-h-8 w-full items-center justify-center rounded-xl border border-(--orange)/30 bg-white px-3 text-xs font-semibold text-black transition-colors hover:bg-(--orange)/5 disabled:cursor-not-allowed disabled:opacity-40 sm:min-h-9 sm:text-sm ${captchaToken && status !== "submitting" ? "cursor-pointer" : ""}`}
                >
                  {payVerb} – e-Transfer
                </button>
              </>
            )}
            {showCardConfirm && (
              <button
                type="button"
                onClick={handleConfirmPayment}
                disabled={!captchaToken || status === "submitting"}
                className={`${primaryButtonClassName} w-full ${captchaToken && status !== "submitting" ? "cursor-pointer" : ""}`}
              >
                {status === "submitting" ? "Sending..." : "I've completed the payment"}
              </button>
            )}
            {showEtransferPanel && (
              <button
                type="button"
                onClick={handleConfirmPayment}
                disabled={!captchaToken || status === "submitting"}
                className={`${primaryButtonClassName} w-full ${captchaToken && status !== "submitting" ? "cursor-pointer" : ""}`}
              >
                {status === "submitting" ? "Sending..." : "I've sent it"}
              </button>
            )}
            {!isFirst && (
              <button
                type="button"
                onClick={showCardConfirm || showEtransferPanel ? handleResetPaymentMethod : handleBack}
                className="focus-ring-light mx-auto mt-1 inline-flex cursor-pointer items-center justify-center text-xs font-medium text-black/60 underline decoration-black/20 underline-offset-2 transition-colors hover:text-black/80 hover:decoration-black/40"
              >
                Back
              </button>
            )}
          </div>
        ) : (
          <>
        <div className="flex min-w-18 shrink-0 justify-start">
          {!isFirst && (
            <button
              type="button"
              onClick={handleBack}
              className="focus-ring-light inline-flex min-h-10 cursor-pointer items-center justify-center rounded-xl px-3 text-sm font-semibold text-black/75 transition-colors hover:bg-(--brown-dark)/5"
            >
              Back
            </button>
          )}
        </div>

        {isLast ? (
          <div className="ml-auto flex flex-1 justify-end">
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!canProceed || status === "submitting"}
              className={`${primaryButtonClassName} ${canProceed && status !== "submitting" ? "cursor-pointer" : ""}`}
            >
              {status === "submitting" ? "Sending..." : submitLabel}
            </button>
          </div>
        ) : (
          <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
            <button
              type="button"
              onClick={handleContinue}
              disabled={!canProceed || status === "submitting"}
              className={`${primaryButtonClassName} ${canProceed && status !== "submitting" ? "cursor-pointer" : ""}`}
            >
              Continue
            </button>
          </div>
        )}
          </>
        )}
      </div>
    </div>
  );
}
