"use client";

/* ---------------------------------------------------------------------------
   Custom dialogs for the Notes app — replace the native window.prompt /
   window.confirm with proper Hub-styled modals. Same visual language as
   the rest of the app: rounded cards, --bg-secondary, --border-color,
   primary ("--bg-inverted") + ghost buttons.
   --------------------------------------------------------------------------- */

import { useEffect, useRef, useState } from "react";
import { ScrollLockOverlay } from "@/hooks/useScrollLock";
import SpinnerIcon from "@/components/icons/ui/SpinnerIcon";
import CrossIcon from "@/components/icons/ui/CrossIcon";
import ExclamationIcon from "@/components/icons/ui/ExclamationIcon";

/* ── Prompt dialog (replaces window.prompt) ─────────────────────────────── */

export function PromptDialog({
  open,
  title,
  description,
  label,
  placeholder,
  initialValue,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onClose,
}: {
  open: boolean;
  title: string;
  description?: string;
  label?: string;
  placeholder?: string;
  initialValue?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: (value: string) => void | Promise<void>;
  onClose: () => void;
}) {
  const [value, setValue] = useState(initialValue ?? "");
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setValue(initialValue ?? "");
      setBusy(false);
      // Autofocus the input after the modal mounts.
      setTimeout(() => inputRef.current?.focus(), 60);
    }
  }, [open, initialValue]);

  if (!open) return null;

  const submit = async () => {
    setBusy(true);
    try {
      await onConfirm(value.trim());
      onClose();
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScrollLockOverlay className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm flex items-start justify-center pt-[15vh] p-4">
      <div
        className="w-full max-w-md rounded-2xl bg-[var(--bg-secondary)] border border-[var(--border-color)] shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-[var(--border-subtle)]">
          <h2 className="text-[14px] font-semibold text-[var(--text-primary)]">
            {title}
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-[var(--bg-surface-hover)] transition-colors"
          >
            <CrossIcon className="h-3.5 w-3.5 text-[var(--text-dim)]" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-3">
          {description && (
            <p className="text-[12.5px] text-[var(--text-muted)] leading-relaxed">
              {description}
            </p>
          )}
          {label && (
            <label className="block text-[10px] font-semibold uppercase tracking-wider text-[var(--text-dim)]">
              {label}
            </label>
          )}
          <input
            ref={inputRef}
            type="text"
            value={value}
            placeholder={placeholder}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && value.trim()) void submit();
              if (e.key === "Escape") onClose();
            }}
            className="w-full h-10 px-3.5 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[13px] text-[var(--text-primary)] placeholder:text-[var(--text-dim)] outline-none focus:border-[var(--border-focus)] transition-colors"
          />
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-5 py-3.5 border-t border-[var(--border-subtle)]">
          <button
            onClick={onClose}
            disabled={busy}
            className="h-9 px-4 rounded-lg text-[12.5px] font-medium text-[var(--text-dim)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)] transition-colors disabled:opacity-40"
          >
            {cancelLabel ?? "Cancel"}
          </button>
          <button
            onClick={() => void submit()}
            disabled={busy}
            className="h-9 px-4 rounded-lg bg-[var(--bg-inverted)] text-[var(--text-inverted)] text-[12.5px] font-semibold flex items-center gap-2 hover:opacity-90 transition-all disabled:opacity-40"
          >
            {busy && <SpinnerIcon className="h-3.5 w-3.5 animate-spin" />}
            {confirmLabel ?? "OK"}
          </button>
        </div>
      </div>
    </ScrollLockOverlay>
  );
}

/* ── Confirm dialog (replaces window.confirm) ────────────────────────────── */

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  cancelLabel,
  variant = "default",
  onConfirm,
  onClose,
}: {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "default" | "danger";
  onConfirm: () => void | Promise<void>;
  onClose: () => void;
}) {
  const [busy, setBusy] = useState(false);

  if (!open) return null;

  const submit = async () => {
    setBusy(true);
    try {
      await onConfirm();
      onClose();
    } finally {
      setBusy(false);
    }
  };

  const confirmBtn =
    variant === "danger"
      ? "bg-red-500 text-white hover:bg-red-500/90"
      : "bg-[var(--bg-inverted)] text-[var(--text-inverted)] hover:opacity-90";

  const iconColor =
    variant === "danger" ? "text-red-400" : "text-[var(--text-dim)]";

  return (
    <ScrollLockOverlay className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm flex items-start justify-center pt-[15vh] p-4">
      <div
        className="w-full max-w-sm rounded-2xl bg-[var(--bg-secondary)] border border-[var(--border-color)] shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-5">
          <div className="flex items-start gap-3">
            <div
              className={`h-9 w-9 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] flex items-center justify-center shrink-0 ${iconColor}`}
            >
              <ExclamationIcon className="h-4 w-4" />
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-[14px] font-semibold text-[var(--text-primary)] mb-1">
                {title}
              </h2>
              {description && (
                <p className="text-[12.5px] text-[var(--text-muted)] leading-relaxed">
                  {description}
                </p>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center justify-end gap-2 px-5 py-3.5 border-t border-[var(--border-subtle)]">
          <button
            onClick={onClose}
            disabled={busy}
            className="h-9 px-4 rounded-lg text-[12.5px] font-medium text-[var(--text-dim)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)] transition-colors disabled:opacity-40"
          >
            {cancelLabel ?? "Cancel"}
          </button>
          <button
            onClick={() => void submit()}
            disabled={busy}
            className={`h-9 px-4 rounded-lg text-[12.5px] font-semibold flex items-center gap-2 transition-all disabled:opacity-40 ${confirmBtn}`}
          >
            {busy && <SpinnerIcon className="h-3.5 w-3.5 animate-spin" />}
            {confirmLabel ?? "Confirm"}
          </button>
        </div>
      </div>
    </ScrollLockOverlay>
  );
}
