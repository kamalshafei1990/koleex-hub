"use client";

import CheckIcon from "@/components/icons/ui/CheckIcon";

/* KDS Checkbox — ELECTED CB-3 by owner 2026-08-02 (To-do picker style):
   16px rounded-[5px] square, monochrome inverted fill. The check stays
   mounted and goes transparent when off so toggling never shifts layout. */

export default function Checkbox({
  checked,
  onChange,
  label,
  disabled,
  className = "",
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label?: React.ReactNode;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`inline-flex items-center gap-2 text-[13px] text-[var(--text-primary)] disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
    >
      <span
        className={`h-4 w-4 rounded-[5px] border flex items-center justify-center shrink-0 transition-colors ${
          checked
            ? "bg-[var(--bg-inverted)] border-[var(--bg-inverted)] text-[var(--text-inverted)]"
            : "border-[var(--border-strong)] text-transparent"
        }`}
      >
        <CheckIcon className="h-3 w-3" />
      </span>
      {label}
    </button>
  );
}
