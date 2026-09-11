"use client";

/* ---------------------------------------------------------------------------
   useFocusTrap — a dialog that owns the keyboard while it is open.

   Every modal surface in the AI app (the call screen, its Call settings
   sheet, the project dialog, the picture lightbox) declared aria-modal and
   then moved focus nowhere: Tab reached the composer behind the overlay,
   and closing left focus on <body> (audit, 2026-09-11). One hook, four
   callers:

     · on activate, remember what had focus, then focus the requested
       element, else the first focusable, else the container itself;
     · while active, Tab and Shift+Tab cycle inside the container;
     · on deactivate, give focus back to what had it, if it still exists.

   Nothing is moved when focus is already inside the container (a field
   with autoFocus keeps it).
   --------------------------------------------------------------------------- */

import { useEffect, type RefObject } from "react";

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

function focusables(root: HTMLElement): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
    /* display:none has no offsetParent; a fixed container's children do. */
    (el) => el.offsetParent !== null || getComputedStyle(el).position === "fixed",
  );
}

export function useFocusTrap(
  ref: RefObject<HTMLElement | null>,
  active: boolean,
  opts: { initialFocus?: string; restore?: boolean } = {},
): void {
  const { initialFocus, restore = true } = opts;
  useEffect(() => {
    if (!active) return;
    const root = ref.current;
    if (!root) return;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;

    if (!root.contains(document.activeElement)) {
      const wanted = initialFocus ? root.querySelector<HTMLElement>(initialFocus) : null;
      const first = wanted ?? focusables(root)[0] ?? root;
      if (first === root && !root.hasAttribute("tabindex")) root.setAttribute("tabindex", "-1");
      first.focus({ preventScroll: true });
    }

    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Tab" || e.defaultPrevented) return;
      const list = focusables(root);
      if (list.length === 0) {
        e.preventDefault();
        root.focus({ preventScroll: true });
        return;
      }
      const current = document.activeElement;
      const first = list[0];
      const last = list[list.length - 1];
      if (e.shiftKey) {
        if (current === first || !root.contains(current)) {
          e.preventDefault();
          last.focus();
        }
      } else if (current === last || !root.contains(current)) {
        e.preventDefault();
        first.focus();
      }
    };
    root.addEventListener("keydown", onKey);
    return () => {
      root.removeEventListener("keydown", onKey);
      if (restore && previous && document.contains(previous)) previous.focus({ preventScroll: true });
    };
  }, [ref, active, initialFocus, restore]);
}
