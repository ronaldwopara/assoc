"use client";

/** A row of options where exactly one is picked: clearer than a dropdown when there are only a few choices. */
export function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: ReadonlyArray<{ value: T; label: string }>;
  onChange: (value: T) => void;
}) {
  return (
    <div className="dash-segmented" role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          className="dash-segmented-option focus-ring-light"
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** On/off switch with its current state written out, so nobody has to read the knob. */
export function Switch({
  checked,
  onChange,
  onLabel,
  offLabel,
  disabled,
  title,
}: {
  checked: boolean;
  onChange: () => void;
  onLabel: string;
  offLabel: string;
  disabled?: boolean;
  title?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      className="dash-switch focus-ring-light"
      onClick={onChange}
      disabled={disabled}
      title={title}
    >
      <span className="dash-switch-track" aria-hidden />
      {checked ? onLabel : offLabel}
    </button>
  );
}

/** Button content that swaps to a spinner while working. The original content stays
 *  in the layout (invisible), so the button keeps its exact size and nothing shifts. */
export function Busy({ busy, children }: { busy: boolean; children: React.ReactNode }) {
  return (
    <span className="dash-busy" data-busy={busy || undefined}>
      <span className="dash-busy-content" aria-hidden={busy || undefined}>
        {children}
      </span>
      {busy && <span className="dash-spinner" role="status" aria-label="Working" />}
    </span>
  );
}
