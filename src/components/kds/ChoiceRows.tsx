"use client";

import CheckIcon from "@/components/icons/ui/CheckIcon";

/* KDS ChoiceRows — ELECTED RD-2 by owner 2026-08-02 (Settings sounds
   style, delegated between RD-2/RD-4): iOS checkmark rows — no radio
   dot, selection = semibold + trailing check. The 20px check slot is
   ALWAYS reserved so toggling never shifts the row. For dense
   many-option pickers arrange the same rows in a 2-col grid. */

export default function ChoiceRows<T extends string>({
  options,
  value,
  onChange,
  className = "",
}: {
  options: { value: T; label: React.ReactNode; hint?: React.ReactNode }[];
  value: T | null;
  onChange: (v: T) => void;
  className?: string;
}) {
  return (
    <div role="radiogroup" className={`rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)] px-2 ${className}`}>
      {options.map((o, i) => {
        const selected = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(o.value)}
            className={`flex w-full items-center justify-between gap-3 rounded-lg px-2 py-3 text-start transition-colors hover:bg-[var(--bg-surface-hover)] ${
              i < options.length - 1 ? "border-b border-[var(--border-faint)]" : ""
            }`}
          >
            <span className="min-w-0">
              <span className={`block truncate text-[13px] text-[var(--text-primary)] ${selected ? "font-semibold" : ""}`}>{o.label}</span>
              {o.hint && <span className="mt-0.5 block text-[11px] text-[var(--text-dim)]">{o.hint}</span>}
            </span>
            <span className="flex h-5 w-5 shrink-0 items-center justify-center">
              {selected && <CheckIcon className="h-3.5 w-3.5 text-[var(--text-primary)]" />}
            </span>
          </button>
        );
      })}
    </div>
  );
}
