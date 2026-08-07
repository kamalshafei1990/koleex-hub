"use client";

/* ---------------------------------------------------------------------------
   useInput — the kit way to replace window.prompt().

   Completes the popup family (useConfirm / useToast): one themed input
   dialog, CF-1 styling, Enter submits, optional validation.

     const { askInput, inputDialog } = useInput();
     …
     const rename = () =>
       askInput(t("renamePrompt"), async (next) => { await save(next); }, {
         initial: current,
         confirmLabel: "Rename",
         validate: (v) => (v.trim() ? null : "Required"),
       });
     …
     return (<>…{inputDialog}</>);

   Cancel always aborts — deliberately stricter than some legacy prompt()
   flows that proceeded even on cancel.
   --------------------------------------------------------------------------- */

import { useCallback, useState, type ReactNode } from "react";

interface Ask {
  title: ReactNode;
  onSubmit: (value: string) => void | Promise<void>;
  initial?: string;
  placeholder?: string;
  confirmLabel?: string;
  validate?: (value: string) => string | null;
}

export function useInput() {
  const [ask, setAsk] = useState<Ask | null>(null);
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);

  const askInput = useCallback(
    (title: ReactNode, onSubmit: (value: string) => void | Promise<void>, opts?: Omit<Ask, "title" | "onSubmit">) => {
      setValue(opts?.initial ?? "");
      setError(null);
      setAsk({ title, onSubmit, ...opts });
    },
    [],
  );

  const submit = () => {
    if (!ask) return;
    const err = ask.validate ? ask.validate(value) : null;
    if (err) { setError(err); return; }
    const run = ask.onSubmit;
    setAsk(null);
    void run(value);
  };

  const inputDialog = ask ? (
    <div
      className="fixed inset-0 z-[300] flex items-center justify-center px-4 bg-black/60 backdrop-blur-sm"
      onClick={() => setAsk(null)}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="w-full max-w-sm rounded-2xl border border-white/[0.08] bg-[var(--bg-secondary)] shadow-[0_24px_64px_-24px_rgba(0,0,0,0.7)] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-4 py-3.5">
          <p className="text-[13px] font-semibold tracking-tight text-[var(--text-primary)]">{ask.title}</p>
          <input
            autoFocus
            value={value}
            onChange={(e) => { setValue(e.target.value); if (error) setError(null); }}
            onKeyDown={(e) => { if (e.key === "Enter") submit(); if (e.key === "Escape") setAsk(null); }}
            placeholder={ask.placeholder}
            className="mt-2.5 w-full h-9 px-3 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[12.5px] text-[var(--text-primary)] outline-none focus:border-[var(--border-focus)] placeholder:text-[var(--text-ghost)]"
          />
          {error && <p className="mt-1.5 text-[11px] text-rose-400">{error}</p>}
        </div>
        <div className="flex items-center justify-end gap-2 border-t border-white/[0.05] px-4 py-3">
          <button
            type="button"
            onClick={() => setAsk(null)}
            className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-1.5 text-[12px] font-medium text-[var(--text-secondary)] transition-colors hover:bg-white/[0.05] hover:text-[var(--text-primary)]"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={submit}
            className="rounded-lg border border-transparent bg-[var(--bg-inverted)] px-3 py-1.5 text-[12px] font-semibold text-[var(--text-inverted)] transition-opacity hover:opacity-90"
          >
            {ask.confirmLabel ?? "OK"}
          </button>
        </div>
      </div>
    </div>
  ) : null;

  return { askInput, inputDialog };
}
