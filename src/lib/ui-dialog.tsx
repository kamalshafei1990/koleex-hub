"use client";

/* ---------------------------------------------------------------------------
   ui-dialog — global, themed replacement for window.confirm /
   window.alert / window.prompt.

   The native browser dialogs render with iOS / Chrome system chrome
   (white modal + blue "OK / Cancel" buttons) which clashes badly
   with the Hub's dark theme. This module exposes an imperative
   Promise-based API that callers use exactly like the natives, plus
   a `<DialogHost />` mounted once at the root that actually renders
   them in the Hub's design language (same Modal / button tokens as
   the rest of the admin).

   Usage anywhere — including non-React modules:

     import { dialog } from "@/lib/ui-dialog";
     if (!(await dialog.confirm("Delete this item?"))) return;

   For richer prompts pass an options object:

     await dialog.confirm({
       title: "Delete product",
       message: "This removes the product, its models, and media.",
       confirmLabel: "Delete",
       destructive: true,
     });

   The host is mounted once in src/app/layout.tsx so every page in
   the app has access. If `dialog.confirm()` is called BEFORE the
   host has mounted (vanishingly rare — only during early
   server-rendered code paths) the call is queued and replays on
   mount.
   --------------------------------------------------------------------------- */

import { useEffect, useMemo, useRef, useState } from "react";
import Modal from "@/components/admin/form-sections/Modal";

type ConfirmOpts = {
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
};

type AlertOpts = {
  title?: string;
  message: string;
  confirmLabel?: string;
};

type PromptOpts = {
  title?: string;
  message?: string;
  defaultValue?: string;
  placeholder?: string;
  confirmLabel?: string;
  cancelLabel?: string;
};

type Pending =
  | { kind: "confirm"; opts: Required<Pick<ConfirmOpts, "message">> & ConfirmOpts; resolve: (v: boolean) => void }
  | { kind: "alert";   opts: Required<Pick<AlertOpts,   "message">> & AlertOpts;   resolve: () => void }
  | { kind: "prompt";  opts: PromptOpts; resolve: (v: string | null) => void };

/* ─── Singleton broker ──────────────────────────────────────────────
   We keep a tiny state machine outside React so any code (event
   handler, async fn, even a regular module fn) can call the API.
   `subscribe` connects the live <DialogHost /> to the queue. */
type Listener = (next: Pending | null) => void;
const listeners = new Set<Listener>();
const queue: Pending[] = [];
let active: Pending | null = null;

function emit() {
  for (const l of listeners) l(active);
}

function next() {
  if (active) return;
  active = queue.shift() ?? null;
  emit();
}

function enqueue(p: Pending) {
  queue.push(p);
  next();
}

function finishCurrent() {
  active = null;
  next();
}

export const dialog = {
  /** Themed replacement for window.confirm(). Accepts a string for
   *  trivial cases or a full options object for titled / destructive
   *  variants. Resolves true when the user clicks Confirm. */
  confirm(opts: ConfirmOpts | string): Promise<boolean> {
    const o: ConfirmOpts = typeof opts === "string" ? { message: opts } : opts;
    return new Promise<boolean>((resolve) => {
      enqueue({ kind: "confirm", opts: o as Required<Pick<ConfirmOpts, "message">> & ConfirmOpts, resolve });
    });
  },

  /** Themed replacement for window.alert(). Resolves when the user
   *  acknowledges. */
  alert(opts: AlertOpts | string): Promise<void> {
    const o: AlertOpts = typeof opts === "string" ? { message: opts } : opts;
    return new Promise<void>((resolve) => {
      enqueue({ kind: "alert", opts: o as Required<Pick<AlertOpts, "message">> & AlertOpts, resolve });
    });
  },

  /** Themed replacement for window.prompt(). Resolves to the entered
   *  string, or null on cancel (matching the native API). */
  prompt(opts: PromptOpts | string): Promise<string | null> {
    const o: PromptOpts = typeof opts === "string" ? { message: opts } : opts;
    return new Promise<string | null>((resolve) => {
      enqueue({ kind: "prompt", opts: o, resolve });
    });
  },
};

/* ─── DialogHost (mount once at root) ────────────────────────────── */

export default function DialogHost() {
  const [current, setCurrent] = useState<Pending | null>(null);
  const [input, setInput] = useState("");
  const inputRef = useRef<HTMLInputElement | null>(null);
  /* Latch the original prompt's defaultValue across renders so the
     input isn't reset by the parent's re-renders while open. */
  const lastPromptKey = useRef<unknown>(null);

  useEffect(() => {
    const listener: Listener = (n) => setCurrent(n);
    listeners.add(listener);
    listener(active);
    return () => { listeners.delete(listener); };
  }, []);

  useEffect(() => {
    if (current?.kind === "prompt" && current !== lastPromptKey.current) {
      setInput(current.opts.defaultValue ?? "");
      lastPromptKey.current = current;
      // Focus next tick so the modal is mounted.
      setTimeout(() => { inputRef.current?.focus(); inputRef.current?.select(); }, 0);
    }
  }, [current]);

  const close = () => {
    if (!current) return;
    if (current.kind === "confirm") current.resolve(false);
    else if (current.kind === "alert") current.resolve();
    else current.resolve(null);
    finishCurrent();
  };

  const submit = () => {
    if (!current) return;
    if (current.kind === "confirm") current.resolve(true);
    else if (current.kind === "alert") current.resolve();
    else current.resolve(input);
    finishCurrent();
  };

  const heading = useMemo(() => {
    if (!current) return "";
    if (current.opts.title) return current.opts.title;
    if (current.kind === "confirm") return "Confirm";
    if (current.kind === "alert")   return "Notice";
    return "";
  }, [current]);

  if (!current) return null;

  const isDestructive = current.kind === "confirm" && current.opts.destructive === true;
  const confirmLabel  =
    current.kind === "alert"   ? (current.opts.confirmLabel ?? "OK")
    : current.kind === "prompt" ? (current.opts.confirmLabel ?? "OK")
    : (current.opts.confirmLabel ?? "Confirm");
  const cancelLabel   =
    current.kind === "alert" ? null
    : (current.kind === "prompt" ? (current.opts.cancelLabel ?? "Cancel")
      : (current.opts.cancelLabel ?? "Cancel"));

  const confirmBtnCls = isDestructive
    ? "h-10 px-6 rounded-xl bg-red-500 text-white text-[13px] font-semibold hover:bg-red-600 transition-colors"
    : "h-10 px-6 rounded-xl bg-[var(--bg-inverted)] text-[var(--text-inverted)] text-[13px] font-semibold hover:opacity-90 transition-all";

  return (
    <Modal
      open={true}
      onClose={close}
      title={heading || (current.kind === "prompt" ? "Enter a value" : "Confirm")}
      width="max-w-md"
      footer={
        <>
          {cancelLabel && (
            <button
              type="button"
              onClick={close}
              className="h-10 px-5 rounded-xl text-[13px] font-medium text-[var(--text-dim)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface)] transition-colors"
            >
              {cancelLabel}
            </button>
          )}
          <button type="button" onClick={submit} className={confirmBtnCls}>
            {confirmLabel}
          </button>
        </>
      }
    >
      {current.kind === "prompt" ? (
        <div className="space-y-3">
          {current.opts.message && (
            <p className="text-[13px] text-[var(--text-muted)] leading-relaxed">{current.opts.message}</p>
          )}
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") { e.preventDefault(); submit(); }
              else if (e.key === "Escape") { e.preventDefault(); close(); }
            }}
            placeholder={current.opts.placeholder}
            className="w-full h-11 px-4 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[14px] text-[var(--text-primary)] placeholder-[var(--text-ghost)] focus:border-[var(--border-focus)] focus:outline-none transition-colors"
          />
        </div>
      ) : (
        <p className="text-[13px] text-[var(--text-muted)] leading-relaxed whitespace-pre-line">
          {current.opts.message}
        </p>
      )}
    </Modal>
  );
}
