"use client";

/* ---------------------------------------------------------------------------
   DocTitlePicker — the heading a commercial document prints under, chosen from
   the document toolbar.

   It lives in the HEADER, next to Back / Save / Convert (owner's call, and the
   right one): the title decides what the document IS. The same record
   legitimately goes out as a Proforma Invoice for L/C issuance and later as a
   Commercial Invoice after shipment, so this is a top-level decision, not a
   terms detail buried inside a modal.

   Shared by Quotations, Invoices and Documents so all three behave the same.

   Picking copies the heading TEXT onto the document, not just the row id — a
   title later renamed or deactivated in settings must never rewrite a
   document already issued under it.

   ── Why the menu is a body PORTAL ──────────────────────────────────────────
   First build rendered it as an absolutely-positioned child of the toolbar and
   it came out translucent, with the Send / Print / Delete buttons showing
   straight through it. Two causes, both worth remembering:

     1. `--bg-elevated` is NOT an opaque colour — it resolves to
        `--bg-surface-hover`, i.e. `rgba(255,255,255,0.10)`. It is a hover
        WASH, meant to sit on top of something. As a menu background it is
        90% see-through. Menus need `--bg-secondary` (#111111 / #F8F8F8).
     2. The toolbar carries `kx-glass`, which sets `backdrop-filter`. That
        creates a stacking context, so any z-index inside it is trapped
        beneath later siblings no matter how large the number.

   Portalling to document.body escapes the stacking context entirely and is
   the same pattern the schema-specs dropdowns already use.
   --------------------------------------------------------------------------- */

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

export interface DocTitleRow {
  id: string;
  code: string;
  label_en: string;
  label_zh: string | null;
  label_ar: string | null;
  doc_family: "quotation" | "invoice";
  meta_noun: string | null;
  shows_validity: boolean;
  is_system: boolean;
}

export default function DocTitlePicker({
  titleId,
  titleText,
  fallbackLabel,
  onPick,
}: {
  titleId?: string;
  titleText?: string;
  /** Heading used when nothing is picked — the host app's own default. */
  fallbackLabel: string;
  onPick: (row: { id?: string; text?: string; noun?: string; validity?: boolean; code?: string }) => void;
}) {
  const [rows, setRows] = useState<DocTitleRow[]>([]);
  const [open, setOpen] = useState(false);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/document-titles", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!cancelled) setRows((d?.rows as DocTitleRow[] | undefined) ?? []);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  /* A fixed-position menu has to follow its trigger, because the toolbar
     scrolls with the page. `true` on the scroll listener catches scrolling
     inside any ancestor, not just the window. */
  useEffect(() => {
    if (!open) return;
    const update = () => {
      if (triggerRef.current) setRect(triggerRef.current.getBoundingClientRect());
    };
    update();
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (triggerRef.current?.contains(t) || menuRef.current?.contains(t)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const shown = titleText?.trim() || fallbackLabel;
  const groups: Array<["quotation" | "invoice", string]> = [
    ["quotation", "Before the sale"],
    ["invoice", "After the sale"],
  ];

  const choose = (r?: DocTitleRow) => {
    /* The noun and validity flag travel WITH the text — the rest of the
       sheet reads from them, and a title edited in settings later must not
       change a document already issued. */
    onPick(
      r
        ? {
            id: r.id,
            text: r.label_en,
            noun: r.meta_noun ?? (r.doc_family === "invoice" ? "Invoice" : "Quotation"),
            validity: r.shows_validity,
            /* The stable code, not the printed label — a title renamed in
               settings must not change how a document behaves. */
            code: r.code,
          }
        : {},
    );
    setOpen(false);
  };

  /* Room below the trigger for a menu of this height, or flip above it.
     The toolbar sits at the top of the page so it almost always opens
     downward, but a short window would otherwise clip the list. */
  const MENU_MAX = 320;
  const flipUp = rect ? window.innerHeight - rect.bottom < MENU_MAX + 16 : false;

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        title="The heading this document prints under"
        aria-haspopup="listbox"
        aria-expanded={open}
        style={{
          display: "inline-flex", alignItems: "center", gap: 6,
          padding: "8px 11px", borderRadius: 8, cursor: "pointer",
          fontSize: 12.5, fontWeight: 600, whiteSpace: "nowrap",
          background: "var(--bg-surface)",
          color: titleText ? "var(--text-primary)" : "var(--text-muted)",
          border: `1px solid ${open || titleText ? "var(--border-focus)" : "var(--border-subtle)"}`,
        }}
      >
        <span style={{ maxWidth: 190, overflow: "hidden", textOverflow: "ellipsis" }}>{shown}</span>
        <span style={{ fontSize: 9, opacity: 0.6 }}>▾</span>
      </button>

      {open && rect && typeof document !== "undefined" &&
        createPortal(
          <div
            ref={menuRef}
            role="listbox"
            style={{
              position: "fixed",
              top: flipUp ? undefined : rect.bottom + 6,
              bottom: flipUp ? window.innerHeight - rect.top + 6 : undefined,
              left: rect.left,
              minWidth: Math.max(rect.width, 240),
              maxHeight: MENU_MAX,
              overflowY: "auto",
              zIndex: 2000,
              padding: 5,
              borderRadius: 10,
              /* Opaque — NOT --bg-elevated, which is a 10% hover wash. */
              background: "var(--bg-secondary)",
              border: "1px solid var(--border-subtle)",
              boxShadow: "0 16px 42px -12px rgba(0,0,0,0.75)",
            }}
          >
            <MenuRow active={!titleId} onClick={() => choose(undefined)}>
              <span style={{ opacity: 0.7 }}>Default — {fallbackLabel}</span>
            </MenuRow>

            {groups.map(([family, label]) => {
              const items = rows.filter((r) => r.doc_family === family);
              if (!items.length) return null;
              return (
                <div key={family}>
                  <div
                    style={{
                      padding: "8px 9px 3px", fontSize: 9.5, fontWeight: 700,
                      letterSpacing: "0.09em", textTransform: "uppercase",
                      color: "var(--text-dim)",
                    }}
                  >
                    {label}
                  </div>
                  {/* English only. The Arabic and Chinese labels stay on the
                      row for printing a translated document later, but beside
                      a term as standard as "Commercial Invoice" they were just
                      noise in the menu (owner, 2026-08-24). */}
                  {items.map((r) => (
                    <MenuRow
                      key={r.id}
                      active={titleId === r.id}
                      onClick={() => choose(r)}
                    >
                      {r.label_en}
                    </MenuRow>
                  ))}
                </div>
              );
            })}
          </div>,
          document.body,
        )}
    </>
  );
}

function MenuRow({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  const [hover, setHover] = useState(false);
  return (
    <button
      type="button"
      role="option"
      aria-selected={active}
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: "flex", alignItems: "center", gap: 10, width: "100%",
        padding: "7px 9px", borderRadius: 7, cursor: "pointer",
        fontSize: 12.5, fontWeight: active ? 600 : 500, textAlign: "start",
        background: active
          ? "var(--bg-surface-subtle)"
          : hover
            ? "var(--bg-surface-hover)"
            : "transparent",
        color: "var(--text-primary)",
        border: 0,
      }}
    >
      {children}
    </button>
  );
}
