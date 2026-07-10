"use client";

/* ---------------------------------------------------------------------------
   PortCombobox — a clean, brand-aligned searchable dropdown for the packing
   list's port pickers (and reusable for any single-select-from-list field).

   Why not a native <select>/<datalist>: they look off-brand and a custom
   absolutely-positioned dropdown gets clipped by the meta strip's
   overflow:hidden rounded frame. So the panel is rendered in a PORTAL to
   <body> with fixed positioning computed from the trigger's rect — it floats
   above everything and never clips.
   --------------------------------------------------------------------------- */

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

const T = {
  ink: "#1A1A1A",
  inkSoft: "#4B5563",
  inkGhost: "#9CA3AF",
  border: "#E5E7EB",
  surface: "#F5F5F5",
  black: "#0A0A0A",
};

export function PortCombobox({
  value,
  onChange,
  options,
  placeholder,
  disabled,
  allowCustom = false,
}: {
  value: string;
  onChange: (v: string) => void;
  options: string[];
  placeholder: string;
  disabled?: boolean;
  /** When true, the typed query itself can be committed (for ports not on the list). */
  allowCustom?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [rect, setRect] = useState<{ top: number; left: number; width: number } | null>(null);
  const [mounted, setMounted] = useState(false);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const searchRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => setMounted(true), []);

  const place = () => {
    const el = triggerRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setRect({ top: r.bottom + 4, left: r.left, width: Math.max(r.width, 220) });
  };

  const openMenu = () => {
    if (disabled) return;
    place();
    setQuery("");
    setOpen(true);
    setTimeout(() => searchRef.current?.focus(), 0);
  };
  const close = () => setOpen(false);

  // Reposition on scroll/resize while open; close on outside click / Escape.
  useEffect(() => {
    if (!open) return;
    const onScroll = () => place();
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") close(); };
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (triggerRef.current?.contains(t) || panelRef.current?.contains(t)) return;
      close();
    };
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onScroll);
    window.addEventListener("keydown", onKey);
    window.addEventListener("mousedown", onDown);
    return () => {
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onScroll);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("mousedown", onDown);
    };
  }, [open]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => o.toLowerCase().includes(q));
  }, [query, options]);

  const commit = (v: string) => { onChange(v); close(); };
  const exactMatch = options.some((o) => o.toLowerCase() === query.trim().toLowerCase());

  return (
    <>
      <button
        type="button"
        ref={triggerRef}
        onClick={() => (open ? close() : openMenu())}
        disabled={disabled}
        style={{
          all: "unset",
          boxSizing: "border-box",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 6,
          width: "100%",
          fontSize: 11,
          lineHeight: 1.4,
          color: value ? T.ink : T.inkGhost,
          cursor: disabled ? "not-allowed" : "pointer",
          opacity: disabled ? 0.5 : 1,
          fontFamily: "inherit",
        }}
      >
        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {value || placeholder}
        </span>
        <svg className="no-print" width="10" height="10" viewBox="0 0 12 12" fill="none" style={{ flexShrink: 0, color: T.inkGhost }}>
          <path d={open ? "M2.5 7.5L6 4l3.5 3.5" : "M2.5 4.5L6 8l3.5-3.5"} stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {mounted && open && rect && createPortal(
        <div
          ref={panelRef}
          style={{
            position: "fixed",
            top: rect.top,
            left: rect.left,
            width: rect.width,
            maxHeight: 260,
            display: "flex",
            flexDirection: "column",
            background: "#fff",
            border: `1px solid ${T.border}`,
            borderRadius: 10,
            boxShadow: "0 8px 28px rgba(0,0,0,0.14)",
            zIndex: 9999,
            overflow: "hidden",
            fontFamily: "-apple-system, BlinkMacSystemFont, 'Helvetica Neue', Arial, sans-serif",
          }}
        >
          <div style={{ padding: 8, borderBottom: `1px solid ${T.border}` }}>
            <input
              ref={searchRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  if (filtered[0]) commit(filtered[0]);
                  else if (allowCustom && query.trim()) commit(query.trim());
                }
              }}
              placeholder="Search…"
              style={{
                all: "unset",
                boxSizing: "border-box",
                width: "100%",
                fontSize: 12,
                color: T.ink,
                padding: "7px 10px",
                background: T.surface,
                borderRadius: 7,
                fontFamily: "inherit",
              }}
            />
          </div>
          <div style={{ overflowY: "auto", padding: 4 }}>
            {allowCustom && query.trim() && !exactMatch && (
              <Option label={`Use “${query.trim()}”`} onClick={() => commit(query.trim())} muted />
            )}
            {filtered.length === 0 && !allowCustom && (
              <div style={{ padding: "10px 12px", fontSize: 12, color: T.inkGhost }}>No matches</div>
            )}
            {filtered.map((o) => (
              <Option key={o} label={o} selected={o === value} onClick={() => commit(o)} />
            ))}
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}

function Option({ label, selected, muted, onClick }: { label: string; selected?: boolean; muted?: boolean; onClick: () => void }) {
  const [hover, setHover] = useState(false);
  return (
    <button
      type="button"
      onMouseDown={(e) => { e.preventDefault(); onClick(); }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        all: "unset",
        boxSizing: "border-box",
        display: "block",
        width: "100%",
        padding: "8px 10px",
        borderRadius: 7,
        fontSize: 12,
        cursor: "pointer",
        color: muted ? "#4B5563" : "#1A1A1A",
        fontWeight: selected ? 700 : 400,
        background: selected ? "#0A0A0A" : hover ? "#F5F5F5" : "transparent",
        fontFamily: "inherit",
        ...(selected ? { color: "#fff" } : null),
      }}
    >
      {label}
    </button>
  );
}
