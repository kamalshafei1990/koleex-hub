"use client";

import { useLayoutEffect, useState, type ReactNode, type RefObject } from "react";
import { createPortal } from "react-dom";

/* ── FloatLayer — the pickers live on <body>, not inside the card.
   Inside the quick-add card they sat in its glass layer: a backdrop filter
   inside another one sees nothing to blur, so the panel came out see-through,
   and the KPI cards after the card painted over it (owner's screenshots,
   26/09). On <body>, fixed under its anchor, it is above everything and its
   glass has the page to blur — the way every Hub dropdown works. Follows the
   anchor on scroll and resize. ── */
export default function FloatLayer({ anchor, inset, width, layerRef, children }: {
  anchor: RefObject<HTMLElement | null>;
  inset: number;
  width: number;
  layerRef: RefObject<HTMLDivElement | null>;
  children: ReactNode;
}) {
  const [box, setBox] = useState<{ top?: number; bottom?: number; left?: number; right?: number; w: number; maxH: number } | null>(null);
  useLayoutEffect(() => {
    const place = () => {
      const el = anchor.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const rtl = getComputedStyle(el).direction === "rtl";
      const w = Math.min(width, window.innerWidth - 16);
      const room = window.innerWidth <= 767 ? 8 : inset;
      const x = rtl
        ? { right: Math.max(8, window.innerWidth - r.right + room) }
        : { left: Math.min(Math.max(8, r.left + room), window.innerWidth - w - 8) };
      /* Open upward when the anchor sits low and there is more room above
         (the Label field at the foot of the task window). */
      const below = window.innerHeight - r.bottom - 12;
      const above = r.top - 12;
      const up = below < 320 && above > below;
      setBox(up
        ? { ...x, bottom: window.innerHeight - r.top + 4, w, maxH: above }
        : { ...x, top: r.bottom + 4, w, maxH: below });
    };
    place();
    window.addEventListener("scroll", place, true);
    window.addEventListener("resize", place);
    return () => { window.removeEventListener("scroll", place, true); window.removeEventListener("resize", place); };
  }, [anchor, inset, width]);
  if (!box || typeof document === "undefined") return null;
  return createPortal(
    /* zIndex 120: above ScrollLockOverlay's 110, so a picker opened from the
       task window sits on top of it too. */
    <div ref={layerRef} className="kx-app fixed overflow-y-auto" style={{ zIndex: 120, top: box.top, bottom: box.bottom, left: box.left, right: box.right, width: box.w, maxHeight: box.maxH }}>
      {children}
    </div>,
    document.body,
  );
}
