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
import { createPortal } from "react-dom";
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
  const panelRef = useRef<HTMLDivElement>(null);
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

  /* ── The panel lives on <body>, not next to the trigger ──────────────────
     A `backdrop-filter` ancestor STARVES a descendant's own backdrop-filter:
     the child samples the parent's already-filtered layer instead of the page,
     so its blur has almost nothing left to work on. Every form card in the Hub
     is `.kx-glass` (blur 16px), so a panel rendered inside one had NO working
     glass — measured: the panel asked for blur(140px) and the text behind it
     stayed sharp. Every "fix" before this raised the FILL instead, until the
     panel was 94% opaque and the blur was decorative.

     Portalling to <body> takes the panel out from under that filter, so the
     blur samples the real page. It also removes two problems that were being
     worked around separately: the panel can no longer be clipped by a card's
     overflow, and it can no longer be buried by a later sibling card, because
     it is not inside a card at all.

     The cost is that position must be computed rather than inherited — hence
     the rect below, refreshed on scroll and resize. */
  const [rect, setRect] = useState<{ top: number; left: number; width: number } | null>(null);
  const place = useCallback(() => {
    const b = btnRef.current;
    if (!b) return;
    const r = b.getBoundingClientRect();
    setRect({ top: r.bottom + 4, left: r.left, width: r.width });
  }, []);

  useEffect(() => {
    if (!open) return;
    place();
    /* Capture phase: the Hub scrolls in #main-scroll-container, not on
       window, so a bubbling listener would never hear it. */
    const onScroll = () => place();
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onScroll);
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      /* The panel is no longer inside wrapRef, so it needs its own test —
         without this, clicking an option would count as an outside click. */
      if (wrapRef.current?.contains(t) || panelRef.current?.contains(t)) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => {
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onScroll);
      document.removeEventListener("mousedown", onDown);
    };
  }, [open, place]);

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
    /* stopPropagation, not just preventDefault: FormModal listens for Escape
       on `document`, so without this one press closes the dropdown AND the
       dialog behind it — the user loses a half-filled form for wanting to
       back out of a list. A native <select> never had this problem because
       the OS picker swallows the key before the page ever sees it. React
       roots below <body>, so stopping here keeps it off document. */
    if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); setOpen(false); btnRef.current?.focus(); return; }
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
      {open && rect && typeof document !== "undefined" && createPortal(
        <>
          {/* THE SCRIM IS WHAT MAKES THE GLASS READABLE. The material itself is
              signed off and must not be thickened — but glass only works when
              there is something soft behind it. Over a dense list the page text
              was reading straight THROUGH an open menu: issue titles cutting
              across "In Progress" / "Verified" on /issues. The bell never had
              this problem because it always dimmed the page behind itself; the
              selects simply never got one. Same geometry as the shell menus,
              which is the look already approved: below the header, so the
              header stays crisp and usable. */}
          <div
            aria-hidden
            onMouseDown={() => setOpen(false)}
            className="fixed inset-x-0 bottom-0 top-[var(--kx-header-h)] bg-black/30 backdrop-blur-sm"
            style={{ zIndex: 199 }}
          />
        <div
          ref={panelRef}
          style={{ position: "fixed", top: rect.top, left: rect.left, minWidth: rect.width, zIndex: 200 }}
          className={`kx-glass-pop kx-pop-panel ${panelWidthClassName === "w-full" ? "" : panelWidthClassName}`}
        >
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
        </>,
        document.body,
      )}
    </div>
  );
}
