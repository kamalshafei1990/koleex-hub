"use client";

/* ---------------------------------------------------------------------------
   SearchCombobox — type, see matches, pick one.

   The Hub had no shared searchable picker. `kds/Select` has type-ahead but no
   filter box and takes its whole option list up front, which cannot work
   against 3,806 ports; `PortCombobox` in the Documents app is hard-coded
   light-mode paper styling for the printed packing list. So this is built from
   the canon parts — MenuList / MenuSearch / MenuBody / MenuItem, which supply
   the MN-5 shell and glass — with the debounce / abort / stale-guard / IME
   loop the CRM contact picker established.

   It lives in components/shipping for now on purpose. Promoting it to
   components/kds means adding it to a barrel that every route imports, and the
   budgets guard has caught exactly that before — so the move belongs in its
   own change, with `npm run validate:budgets` run against it.

   ── Why the request loop looks like this ──────────────────────────────────
   · 220ms debounce — a port name is 4-8 keystrokes, and each one is a
     round-trip on a platform with a ~1s floor
   · every request aborts the one before it
   · a monotonic sequence number, because an aborted request can still resolve
     and an older answer must never overwrite a newer one
   · composition events respected, so Chinese and Japanese candidates are not
     searched mid-word
   · empty query BROWSES (the first page of results) instead of showing
     nothing, so focusing the field is useful on its own
   --------------------------------------------------------------------------- */

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { MenuBody, MenuList, MenuSearch } from "@/components/kds";
import AngleDownIcon from "@/components/icons/ui/AngleDownIcon";
import CrossIcon from "@/components/icons/ui/CrossIcon";
import SpinnerIcon from "@/components/icons/ui/SpinnerIcon";

export interface ComboOption<T> {
  key: string;
  value: T;
  label: string;
  sublabel?: string;
  /** Leading glyph — a flag emoji or an icon. */
  glyph?: React.ReactNode;
  /** Right-aligned monospace tag: a UN/LOCODE or IATA code. */
  code?: string;
  /** Ports Koleex already ships through get a mark. */
  pinned?: boolean;
}

interface Props<T> {
  value: ComboOption<T> | null;
  onChange: (option: ComboOption<T> | null) => void;
  /** Runs debounced and abortable. Return at most ~20 rows. */
  search: (term: string, signal: AbortSignal) => Promise<ComboOption<T>[]>;
  placeholder: string;
  searchPlaceholder: string;
  emptyLabel: string;
  loadingLabel: string;
  disabled?: boolean;
  disabledHint?: string;
  /** Leading glyph on the closed trigger. */
  icon?: React.ReactNode;
  ariaLabel: string;
  clearLabel?: string;
  className?: string;
  /** Re-runs the browse list when this changes — e.g. the selected country. */
  scopeKey?: string;
}

export default function SearchCombobox<T>({
  value, onChange, search, placeholder, searchPlaceholder, emptyLabel, loadingLabel,
  disabled, disabledHint, icon, ariaLabel, clearLabel, className = "", scopeKey = "",
}: Props<T>) {
  const [open, setOpen] = useState(false);
  const [term, setTerm] = useState("");
  const [rows, setRows] = useState<ComboOption<T>[]>([]);
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState(0);
  const [composing, setComposing] = useState(false);

  const hostRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const seqRef = useRef(0);
  const listId = useId();

  /* ── the query loop ──────────────────────────────────────────────────── */
  const run = useCallback((q: string) => {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    const seq = ++seqRef.current;
    setLoading(true);
    search(q, ctrl.signal)
      .then((next) => {
        /* An aborted request can still resolve. Only the newest answer wins. */
        if (seq !== seqRef.current) return;
        setRows(next);
        setActive(0);
        setLoading(false);
      })
      .catch(() => {
        if (seq !== seqRef.current) return;
        setRows([]);
        setLoading(false);
      });
  }, [search]);

  useEffect(() => {
    if (!open || composing) return;
    const t = setTimeout(() => run(term.trim()), term.trim() ? 220 : 0);
    return () => clearTimeout(t);
  }, [open, term, composing, run, scopeKey]);

  /* Reset when the scope changes — a country switch invalidates the port list.
     Adjusted DURING RENDER rather than in an effect: React re-runs this
     component immediately with the new state and never commits the stale list,
     so there is no flash of the previous country's ports and no cascading
     render (react-hooks/set-state-in-effect). */
  const [prevScope, setPrevScope] = useState(scopeKey);
  if (prevScope !== scopeKey) {
    setPrevScope(scopeKey);
    setRows([]);
    setTerm("");
  }

  useEffect(() => () => abortRef.current?.abort(), []);

  /* ── outside click and Escape ────────────────────────────────────────── */
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent | TouchEvent) => {
      if (!hostRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { setOpen(false); triggerRef.current?.focus(); }
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("touchstart", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("touchstart", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const pick = useCallback((o: ComboOption<T>) => {
    onChange(o);
    setOpen(false);
    setTerm("");
    triggerRef.current?.focus();
  }, [onChange]);

  /* Every open starts clean. Leaving the last query in the box meant the next
     open showed the previous search's results, and typing appended to it —
     "cairo" + "pudong" = "cairopudong" and no matches. */
  const toggle = useCallback(() => {
    setOpen((was) => {
      if (!was) { setTerm(""); setRows([]); setActive(0); }
      return !was;
    });
  }, []);

  const onListKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setActive((i) => Math.min(i + 1, rows.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive((i) => Math.max(i - 1, 0)); }
    else if (e.key === "Enter" && rows[active]) { e.preventDefault(); pick(rows[active]); }
  };

  const hint = disabled ? disabledHint : undefined;

  /* A control shaped like a field is MADE of field under Aurora — the global
     rule keys on a `bg-[var(--bg-inverted)]/…` tint plus w-full on a button,
     so this trigger gets the skin's own field material for free. */
  const triggerClass =
    "group flex h-10 w-full items-center gap-2 rounded-xl border border-[var(--border-subtle)] " +
    "bg-[var(--bg-inverted)]/[0.04] px-3 text-start text-[13px] " +
    "hover:border-[var(--border-focus)] focus:outline-none focus-visible:border-[#567FB2]/60 " +
    "focus-visible:shadow-[0_0_0_4px_rgba(86,127,178,0.16)] disabled:opacity-50 disabled:cursor-not-allowed";

  return (
    <div ref={hostRef} className={`relative ${className}`}>
      <button
        ref={triggerRef}
        type="button"
        role="combobox"
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-controls={open ? listId : undefined}
        aria-label={ariaLabel}
        title={hint}
        disabled={disabled}
        onClick={() => !disabled && toggle()}
        className={triggerClass}
      >
        {icon ? <span className="shrink-0 text-[var(--text-dim)]">{icon}</span> : null}
        <span className="min-w-0 flex-1 truncate">
          {value ? (
            <span className="flex items-center gap-2">
              {value.glyph ? <span aria-hidden>{value.glyph}</span> : null}
              <span className="truncate font-medium text-[var(--text-primary)]">{value.label}</span>
              {value.code ? (
                <span className="shrink-0 font-mono text-[11px] tabular-nums text-[var(--text-ghost)]">{value.code}</span>
              ) : null}
            </span>
          ) : (
            <span className="text-[var(--text-ghost)]">{disabled ? (disabledHint ?? placeholder) : placeholder}</span>
          )}
        </span>
        {value && clearLabel ? (
          <span
            role="button"
            tabIndex={-1}
            aria-label={clearLabel}
            onClick={(e) => { e.stopPropagation(); onChange(null); }}
            className="shrink-0 rounded p-0.5 text-[var(--text-ghost)] hover:text-[var(--text-primary)]"
          >
            <CrossIcon size={12} />
          </span>
        ) : null}
        <AngleDownIcon size={12} className="shrink-0 text-[var(--text-ghost)] transition-transform group-aria-expanded:rotate-180" />
      </button>

      {open ? (
        /* kx-glass-pop earns the automatic z-lift that stops the next card
           painting over this panel — see the note in globals.css. */
        <MenuList className="kx-pop-sheet absolute inset-x-0 top-[calc(100%+4px)] z-50 w-full">
          <MenuSearch
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            placeholder={searchPlaceholder}
            autoFocus
            onKeyDown={onListKey}
            onCompositionStart={() => setComposing(true)}
            onCompositionEnd={(e) => {
              setComposing(false);
              setTerm((e.target as HTMLInputElement).value);
            }}
          />
          <MenuBody>
            <div id={listId} role="listbox" aria-label={ariaLabel}>
            {loading && !rows.length ? (
              <div className="flex items-center gap-2 px-3 py-6 text-[12px] text-[var(--text-dim)]">
                <SpinnerIcon size={14} className="animate-spin" />
                {loadingLabel}
              </div>
            ) : rows.length === 0 ? (
              <div className="px-3 py-6 text-center text-[12px] text-[var(--text-dim)]">{emptyLabel}</div>
            ) : (
              rows.map((o, i) => (
                <button
                  key={o.key}
                  type="button"
                  role="option"
                  aria-selected={value?.key === o.key}
                  onMouseEnter={() => setActive(i)}
                  onClick={() => pick(o)}
                  className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-start text-[13px] transition-colors ${
                    i === active ? "bg-[var(--bg-surface-hover)]" : ""
                  } ${value?.key === o.key ? "text-[var(--text-primary)]" : "text-[var(--text-secondary)]"}`}
                >
                  {o.glyph ? <span aria-hidden className="shrink-0 text-[15px] leading-none">{o.glyph}</span> : null}
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5">
                      <span className="truncate font-medium text-[var(--text-primary)]">{o.label}</span>
                      {o.pinned ? <span aria-hidden className="text-[10px] text-[#7FA9D6]">●</span> : null}
                    </span>
                    {o.sublabel ? (
                      <span className="block truncate text-[11px] text-[var(--text-ghost)]">{o.sublabel}</span>
                    ) : null}
                  </span>
                  {o.code ? (
                    <span className="shrink-0 font-mono text-[11px] tabular-nums text-[var(--text-ghost)]">{o.code}</span>
                  ) : null}
                </button>
              ))
            )}
            </div>
          </MenuBody>
        </MenuList>
      ) : null}
    </div>
  );
}
