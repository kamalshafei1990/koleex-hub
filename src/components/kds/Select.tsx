"use client";

/* KDS Select — the Hub's dropdown for a fixed list of options.

   THE REASON THIS FILE EXISTS: a native <select> cannot be styled. Its option
   list is drawn by the operating system, so no stylesheet reaches it — not the
   glass, not the radius, not the hover. The Hub has 358 of them across 123
   files, and every one that should look like MN-5 has to stop being a <select>
   first. This is what it becomes.

   Extracted from Contacts.tsx after wave 1 proved it: leaving it there meant
   the next app would re-implement it, and five apps later there would be five
   dropdowns again — exactly what KDS-1 forbids.

   WHAT A NATIVE <select> GIVES FOR FREE AND THIS HAS TO REBUILD: roving
   keyboard focus (arrows / Home / End), type-ahead, Enter and Escape,
   click-outside, focus returning to the trigger on close, and listbox/option
   roles so a screen reader still announces it as a select.

   WHAT IT COSTS: on a phone a native <select> opens the OS picker — a
   full-width sheet with big targets. Converting trades that for one
   consistent look. The owner made that call on 2026-08-12; it is a real
   trade, not a free upgrade, and it should be re-asked per app where the
   field is numeric (day / month / year pickers keep their <select>).

   The caller owns POSITION and TRIGGER LOOK; this owns the panel and the
   behaviour. That is what lets one component serve a full-width form field, a
   80px inline label picker and a flex-1 add-control. */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import AngleDownIcon from "@/components/icons/ui/AngleDownIcon";
import CheckIcon from "@/components/icons/ui/CheckIcon";

/** A row is either a bare value, or a value with its own display label —
    the `<option value="slug">Localised name</option>` shape, which is what
    most real selects in the Hub actually are. */
export type SelectOption = string | { value: string; label: string };

export default function Select({
  value, onChange, options, renderLabel, placeholder, icon, triggerClassName,
  panelWidthClassName = "w-full", wrapperClassName = "", disabled = false,
}: {
  value: string;
  onChange: (v: string) => void;
  options: SelectOption[];
  /** Only consulted for BARE string options; {value,label} carries its own. */
  renderLabel?: (o: string) => string;
  /** When set, an extra leading row clears the value (native's empty option). */
  placeholder?: string;
  icon?: React.ReactNode;
  triggerClassName: string;
  panelWidthClassName?: string;
  /** Layout for the anchor itself — LabelSelect sits inline in a flex row. */
  wrapperClassName?: string;
  /** Same meaning as on <select>: not focusable, cannot open. Dependent
      filters need it (no division picked yet ⇒ no category to choose). */
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(0);
  const wrapRef = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const typed = useRef({ q: "", at: 0 });

  /* The placeholder is row 0 when present, so every index below is over ONE
     list — no off-by-one between what the arrow keys move and what renders. */
  const rows = useMemo(
    () => (placeholder !== undefined ? [{ v: "", text: placeholder }] : []).concat(
      options.map((o) =>
        typeof o === "string"
          ? { v: o, text: renderLabel ? renderLabel(o) : o }
          : { v: o.value, text: o.label },
      ),
    ),
    [options, renderLabel, placeholder],
  );
  const selectedIdx = Math.max(0, rows.findIndex((r) => r.v === value));
  const current = rows.find((r) => r.v === value);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  /* Open ON the current value, not at the top — a 30-row discount list that
     always opened at "1%" would make the selected row impossible to find.
     Set at the moment of opening rather than in an effect on `open`: an
     effect would fire a second render every time the panel appears, and the
     lint rule that flags synchronous setState in effects is right to. */
  const openAt = () => { setActiveIdx(selectedIdx); setOpen(true); };

  useEffect(() => {
    if (!open || !listRef.current) return;
    const el = listRef.current.children[activeIdx] as HTMLElement | undefined;
    el?.scrollIntoView({ block: "nearest" });
  }, [open, activeIdx]);

  const commit = (i: number) => {
    const row = rows[i];
    if (!row) return;
    onChange(row.v);
    setOpen(false);
    btnRef.current?.focus();
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!open) {
      if (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ") { e.preventDefault(); openAt(); }
      return;
    }
    if (e.key === "Escape") { e.preventDefault(); setOpen(false); btnRef.current?.focus(); return; }
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); commit(activeIdx); return; }
    if (e.key === "ArrowDown") { e.preventDefault(); setActiveIdx((i) => Math.min(rows.length - 1, i + 1)); return; }
    if (e.key === "ArrowUp") { e.preventDefault(); setActiveIdx((i) => Math.max(0, i - 1)); return; }
    if (e.key === "Home") { e.preventDefault(); setActiveIdx(0); return; }
    if (e.key === "End") { e.preventDefault(); setActiveIdx(rows.length - 1); return; }
    /* Type-ahead: letters within 700ms build one query, exactly like a
       native select. Without it a long list is only reachable by scrolling. */
    if (e.key.length === 1 && !e.metaKey && !e.ctrlKey && !e.altKey) {
      const now = Date.now();
      typed.current.q = now - typed.current.at > 700 ? e.key : typed.current.q + e.key;
      typed.current.at = now;
      const q = typed.current.q.toLowerCase();
      const hit = rows.findIndex((r) => r.text.toLowerCase().startsWith(q));
      if (hit >= 0) setActiveIdx(hit);
    }
  };

  return (
    <div ref={wrapRef} className={`relative ${wrapperClassName}`}>
      {icon && <span className="absolute start-3 top-1/2 -translate-y-1/2 text-[var(--text-ghost)] pointer-events-none z-[1]">{icon}</span>}
      <button
        ref={btnRef}
        type="button"
        disabled={disabled}
        onClick={() => (open ? setOpen(false) : openAt())}
        onKeyDown={onKeyDown}
        aria-haspopup="listbox"
        aria-expanded={open}
        data-kx-keep-hover
        className={triggerClassName}
      >
        <span className={`block truncate text-start ${current && current.v !== "" ? "" : "text-[var(--text-ghost)]"}`}>
          {current ? current.text : (placeholder ?? "")}
        </span>
      </button>
      <AngleDownIcon size={14} className={`absolute end-3 top-1/2 -translate-y-1/2 text-[var(--text-ghost)] pointer-events-none transition-transform ${open ? "rotate-180" : ""}`} />
      {open && (
        <div className={`absolute z-50 mt-1 ${panelWidthClassName} kx-glass-pop kx-pop-panel`}>
          <div ref={listRef} role="listbox" tabIndex={-1} onKeyDown={onKeyDown} className="max-h-60 overflow-y-auto py-1">
            {rows.map((r, i) => (
              <button
                key={r.v || "__placeholder"}
                type="button"
                role="option"
                aria-selected={r.v === value}
                onMouseEnter={() => setActiveIdx(i)}
                onClick={() => commit(i)}
                className={`w-full flex items-center gap-2.5 px-2.5 py-2 text-start text-sm transition-colors ${
                  i === activeIdx ? "bg-[rgba(127,169,214,0.16)]" : ""
                } ${r.v === value ? "text-[var(--text-primary)] font-medium" : "text-[var(--text-secondary)]"}`}
              >
                <span className="flex-1 min-w-0 truncate">{r.text}</span>
                {r.v === value && <CheckIcon size={13} className="shrink-0 text-[var(--text-primary)]" />}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
