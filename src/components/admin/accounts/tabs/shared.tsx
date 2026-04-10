"use client";

/* ---------------------------------------------------------------------------
   Shared helpers for the Account Detail tab components. Matches the existing
   Koleex Hub admin design system — same tokens, same spacing, same typography
   as AccountForm.tsx and AccountsList.tsx.
   --------------------------------------------------------------------------- */

import type { ReactNode } from "react";

export const inputClass =
  "w-full h-10 px-3 rounded-lg bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] text-[13px] text-[var(--text-primary)] placeholder:text-[var(--text-dim)] outline-none focus:border-[var(--border-focus)] transition-colors";

export const selectClass =
  "w-full h-10 px-3 rounded-lg bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] text-[13px] text-[var(--text-primary)] outline-none focus:border-[var(--border-focus)] transition-colors";

export const textareaClass =
  "w-full px-3 py-2 rounded-lg bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] text-[13px] text-[var(--text-primary)] placeholder:text-[var(--text-dim)] outline-none focus:border-[var(--border-focus)] transition-colors resize-y";

export const labelClass =
  "block text-[10px] font-semibold text-[var(--text-dim)] mb-1.5 uppercase tracking-wider";

export const tabCardClass =
  "bg-[var(--bg-secondary)] rounded-2xl border border-[var(--border-subtle)] p-5 md:p-6";

export const tabSectionTitle =
  "text-[11px] font-semibold text-[var(--text-dim)] uppercase tracking-wider mb-4 flex items-center gap-2";

export const primaryBtnClass =
  "h-10 px-5 rounded-xl bg-[var(--bg-inverted)] text-[var(--text-inverted)] text-[13px] font-semibold flex items-center gap-2 hover:opacity-90 transition-all shadow-lg disabled:opacity-60";

export const ghostBtnClass =
  "h-10 px-4 rounded-xl bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] text-[var(--text-muted)] text-[13px] font-medium flex items-center gap-2 hover:text-[var(--text-primary)] hover:border-[var(--border-focus)] transition-all disabled:opacity-60";

/** Empty state wrapper for tabs that need a "no data yet" message. */
export function TabEmptyState({
  icon,
  title,
  description,
}: {
  icon: ReactNode;
  title: string;
  description?: string;
}) {
  return (
    <div className="bg-[var(--bg-secondary)] rounded-2xl border border-[var(--border-subtle)] p-10 text-center">
      <div className="inline-flex items-center justify-center h-12 w-12 rounded-full bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] text-[var(--text-dim)] mb-4">
        {icon}
      </div>
      <p className="text-[14px] font-semibold text-[var(--text-muted)]">{title}</p>
      {description && (
        <p className="text-[12px] text-[var(--text-dim)] mt-1 max-w-md mx-auto">
          {description}
        </p>
      )}
    </div>
  );
}

/** Minimal toggle switch matching the rest of the admin surface. */
export function Toggle({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-start justify-between gap-4 cursor-pointer group">
      <div className="min-w-0">
        <p className="text-[13px] text-[var(--text-primary)] font-medium">
          {label}
        </p>
        {description && (
          <p className="text-[11px] text-[var(--text-dim)] mt-0.5">
            {description}
          </p>
        )}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative h-6 w-11 rounded-full shrink-0 transition-colors ${
          checked
            ? "bg-[var(--bg-inverted)]"
            : "bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)]"
        }`}
      >
        <span
          className={`absolute top-1/2 -translate-y-1/2 h-4 w-4 rounded-full bg-white shadow transition-all ${
            checked ? "left-[22px]" : "left-[3px]"
          }`}
        />
      </button>
    </label>
  );
}

/** Action bar shown at the bottom of a tab to Save / Cancel edits. */
export function TabActionBar({
  dirty,
  saving,
  onSave,
  onReset,
}: {
  dirty: boolean;
  saving: boolean;
  onSave: () => void;
  onReset: () => void;
}) {
  return (
    <div className="flex items-center justify-end gap-2 pt-4 mt-5 border-t border-[var(--border-subtle)]">
      <button
        type="button"
        onClick={onReset}
        disabled={!dirty || saving}
        className={ghostBtnClass}
      >
        Reset
      </button>
      <button
        type="button"
        onClick={onSave}
        disabled={!dirty || saving}
        className={primaryBtnClass}
      >
        {saving ? "Saving…" : "Save Changes"}
      </button>
    </div>
  );
}
