"use client";

/* KDS PopoverPanel — an MN-5 panel anchored to a trigger, rendered on <body>.

   WHY IT IS NOT RENDERED NEXT TO ITS TRIGGER. A `backdrop-filter` ancestor
   STARVES a descendant's own backdrop-filter: the child samples the parent's
   already-filtered layer instead of the page. Every form card in the Hub is
   `.kx-glass` (blur 16px), so a panel inside one has NO working glass at any
   radius — measured on the customer form: the panel asked for blur(140px) and
   the heading behind it stayed sharp. Three separate "fixes" raised the FILL
   instead, ending at 94% opacity, which is not glass, it is a tile.

   Portalling to <body> also removes two things that were being worked around
   one at a time: the panel can no longer be clipped by a card's `overflow`,
   and it can no longer be buried by a later sibling card — the `.kx-glass:has()`
   z-lift in globals.css exists only for panels that have NOT moved here yet,
   and should be deleted once they all have.

   The cost is that position has to be computed instead of inherited. That is
   what this component is: the rect, the listeners that keep it true, and the
   outside-click test that has to know about BOTH the anchor and the panel,
   since they are no longer in the same subtree. */

import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import { createPortal } from "react-dom";

export default function PopoverPanel({
  anchorRef,
  open,
  onClose,
  className = "",
  matchAnchorWidth = true,
  align = "start",
  children,
}: {
  anchorRef: RefObject<HTMLElement | null>;
  open: boolean;
  onClose: () => void;
  /** Sizing and any extra layout. The MN-5 shell is applied for you. */
  className?: string;
  /** Panel is at least as wide as the trigger — right for a form field, wrong
      for a menu hanging off a 32px icon button. */
  matchAnchorWidth?: boolean;
  /** `end` right-aligns the panel to the trigger, for menus near the viewport
      edge that would otherwise overflow. */
  align?: "start" | "end";
  children: React.ReactNode;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [rect, setRect] = useState<{ top: number; left: number; right: number; width: number } | null>(null);

  /* onClose arrives as a fresh arrow on every parent render. Held in a ref so
     the effect below does not tear down and re-register on every render — it
     did, and since place() sets a brand-new object each time, that was a
     render → effect → setState → render cycle that left the panel showing a
     rect from some earlier layout. Measured: anchored 14px right and 8px above
     the field it belongs to, and a forced resize did not correct it. */
  const closeRef = useRef(onClose);
  /* Assigned in an effect, not during render: writing a ref while rendering is
     unsafe under concurrent rendering, and the lint rule says so. */
  useEffect(() => { closeRef.current = onClose; }, [onClose]);

  const place = useCallback(() => {
    const a = anchorRef.current;
    if (!a) return;
    const r = a.getBoundingClientRect();
    setRect((prev) =>
      prev && prev.top === r.bottom + 4 && prev.left === r.left && prev.width === r.width
        ? prev /* same box — return the SAME object so React bails out */
        : { top: r.bottom + 4, left: r.left, right: window.innerWidth - r.right, width: r.width },
    );
  }, [anchorRef]);

  useEffect(() => {
    if (!open) return;
    place();
    /* One more pass after paint: the anchor can still be moving when the panel
       opens — a section expanding, a font landing, the list above it growing. */
    const raf = requestAnimationFrame(place);
    /* CAPTURE phase. The Hub scrolls in nested containers, not on window, and
       a scroll event does not bubble — a normal listener would never fire and
       the panel would hang in mid-air while the field moved away under it. */
    const onMove = () => place();
    window.addEventListener("scroll", onMove, true);
    window.addEventListener("resize", onMove);
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (anchorRef.current?.contains(t) || panelRef.current?.contains(t)) return;
      closeRef.current();
    };
    document.addEventListener("mousedown", onDown);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", onMove, true);
      window.removeEventListener("resize", onMove);
      document.removeEventListener("mousedown", onDown);
    };
  }, [open, place, anchorRef]);

  if (!open || !rect || typeof document === "undefined") return null;

  return createPortal(
    <div
      ref={panelRef}
      style={{
        position: "fixed",
        top: rect.top,
        ...(align === "end" ? { right: rect.right } : { left: rect.left }),
        ...(matchAnchorWidth ? { minWidth: rect.width } : null),
        zIndex: 200,
      }}
      className={`kx-glass-pop kx-pop-panel ${className}`}
    >
      {children}
    </div>,
    document.body,
  );
}
