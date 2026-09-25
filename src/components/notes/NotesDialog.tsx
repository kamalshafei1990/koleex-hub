"use client";

/* ---------------------------------------------------------------------------
   Hub-styled replacements for window.prompt / window.confirm.

   The Notes app itself now uses the KDS ConfirmDialog for confirmations;
   PromptDialog (a single-field text prompt, which KDS has no equivalent
   for) is still used by Notes for folder/note names and the link URL.
   ConfirmDialog stays exported because other apps import it
   (hr/modules/Payroll.tsx, ai/KoleexAiApp.tsx).

   Both are real modal dialogs: role="dialog"/"alertdialog", aria-modal,
   labelled by their title, Escape closes. `onConfirm` may return `false`
   to keep the dialog open (e.g. the save failed and the caller showed an
   error).
   --------------------------------------------------------------------------- */

import { useEffect, useId, useRef, useState } from "react";
import { ScrollLockOverlay } from "@/hooks/useScrollLock";
import { useTranslation } from "@/lib/i18n";
import { notesT } from "@/lib/translations/notes";
import CrossIcon from "@/components/icons/ui/CrossIcon";
import ExclamationIcon from "@/components/icons/ui/ExclamationIcon";
import SpinnerIcon from "@/components/icons/ui/SpinnerIcon";

type ConfirmResult = boolean | void;

/** Close on Escape while `open` (and not busy). */
function useEscape(open: boolean, busy: boolean, onClose: () => void) {
  const closeRef = useRef(onClose);
  useEffect(() => { closeRef.current = onClose; }, [onClose]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) {
        e.stopPropagation();
        closeRef.current();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, busy]);
}

/* -- Prompt dialog (replaces window.prompt) ------------------------------- */

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
  onConfirm: (value: string) => ConfirmResult | Promise<ConfirmResult>;
  onClose: () => void;
}) {
  const { t } = useTranslation(notesT);
  const [value, setValue] = useState(initialValue ?? "");
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const titleId = useId();
  const inputId = useId();

  useEffect(() => {
    if (!open) return;
    setValue(initialValue ?? "");
    setBusy(false);
    // Autofocus the input after the modal mounts.
    const id = setTimeout(() => inputRef.current?.focus(), 60);
    return () => clearTimeout(id);
  }, [open, initialValue]);

  useEscape(open, busy, onClose);

  if (!open) return null;

  const submit = async () => {
    setBusy(true);
    try {
      const res = await onConfirm(value.trim());
      if (res !== false) onClose();
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScrollLockOverlay className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm flex items-start justify-center pt-[15vh] p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="kx-glass-pop w-full max-w-md rounded-2xl bg-[var(--bg-secondary)] border border-[var(--border-color)] shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-[var(--border-subtle)]">
          <h2 id={titleId} className="text-[14px] font-semibold text-[var(--text-primary)]">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={t("dialog.close")}
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
            <label htmlFor={inputId} className="block text-[10px] font-semibold uppercase tracking-wider text-[var(--text-dim)]">
              {label}
            </label>
          )}
          <input
            id={inputId}
            ref={inputRef}
            type="text"
            dir="auto"
            value={value}
            placeholder={placeholder}
            aria-label={label ? undefined : title}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !busy) void submit();
            }}
            className="w-full h-10 px-3.5 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[13px] text-[var(--text-primary)] placeholder:text-[var(--text-dim)] outline-none focus:border-[var(--border-focus)] transition-colors"
          />
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-5 py-3.5 border-t border-[var(--border-subtle)]">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="h-10 px-5 rounded-xl text-[13px] font-medium text-[var(--text-dim)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface)] transition-colors disabled:opacity-40"
          >
            {cancelLabel ?? t("dialog.cancel")}
          </button>
          <button
            type="button"
            onClick={() => void submit()}
            disabled={busy}
            className="h-10 px-5 rounded-xl bg-[var(--bg-inverted)] text-[var(--text-inverted)] text-[13px] font-semibold flex items-center gap-2 hover:opacity-90 transition-all shadow-lg disabled:opacity-40"
          >
            {busy && <SpinnerIcon className="h-3.5 w-3.5" />}
            {confirmLabel ?? t("dialog.ok")}
          </button>
        </div>
      </div>
    </ScrollLockOverlay>
  );
}

/* -- Confirm dialog (replaces window.confirm) ----------------------------- */

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
  onConfirm: () => ConfirmResult | Promise<ConfirmResult>;
  onClose: () => void;
}) {
  const { t } = useTranslation(notesT);
  const [busy, setBusy] = useState(false);
  const titleId = useId();
  const descId = useId();

  useEscape(open, busy, onClose);

  if (!open) return null;

  const submit = async () => {
    setBusy(true);
    try {
      const res = await onConfirm();
      if (res !== false) onClose();
    } finally {
      setBusy(false);
    }
  };

  const confirmBtn =
    variant === "danger"
      ? "bg-red-500/15 border border-red-500/30 text-red-700 dark:text-red-400 hover:bg-red-500/25"
      : "bg-[var(--bg-inverted)] text-[var(--text-inverted)] hover:opacity-90 shadow-lg";

  const iconColor =
    variant === "danger" ? "text-red-700 dark:text-red-400" : "text-[var(--text-dim)]";

  return (
    <ScrollLockOverlay className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm flex items-start justify-center pt-[15vh] p-4">
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descId : undefined}
        className="kx-glass-pop w-full max-w-sm rounded-2xl bg-[var(--bg-secondary)] border border-[var(--border-color)] shadow-2xl overflow-hidden"
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
              <h2 id={titleId} className="text-[14px] font-semibold text-[var(--text-primary)] mb-1">
                {title}
              </h2>
              {description && (
                <p id={descId} className="text-[12.5px] text-[var(--text-muted)] leading-relaxed">
                  {description}
                </p>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center justify-end gap-2 px-5 py-3.5 border-t border-[var(--border-subtle)]">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="h-10 px-5 rounded-xl text-[13px] font-medium text-[var(--text-dim)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface)] transition-colors disabled:opacity-40"
          >
            {cancelLabel ?? t("dialog.cancel")}
          </button>
          <button
            type="button"
            onClick={() => void submit()}
            disabled={busy}
            className={`h-10 px-5 rounded-xl text-[13px] font-semibold flex items-center gap-2 transition-all disabled:opacity-40 ${confirmBtn}`}
          >
            {busy && <SpinnerIcon className="h-3.5 w-3.5" />}
            {confirmLabel ?? t("dialog.confirm")}
          </button>
        </div>
      </div>
    </ScrollLockOverlay>
  );
}
