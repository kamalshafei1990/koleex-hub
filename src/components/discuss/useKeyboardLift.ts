"use client";

import { useEffect, useState } from "react";

/* ═══════════════════════════════════════════════════════════════════════════
   useKeyboardLift — WeChat-style composer ride on the on-screen keyboard.

   WHY: layout.tsx already ships `interactive-widget: resizes-content`, which
   makes the keyboard SHRINK the layout viewport on iOS 18.4+ / Chrome 108+ —
   the composer then sits on the keyboard with zero JS. On older engines
   (iOS ≤ 18.3 Safari is the one the owner carries) the keyboard OVERLAYS the
   page instead: the composer stays at the layout bottom, hidden under the
   keyboard, and Safari pans the page in a jarring jump to reveal the caret.

   This hook closes that gap for the fallback engines. It reads
   `window.visualViewport`: the visible height minus the pan offset is the
   strip the keyboard covers. When `resizes-content` is active the layout
   viewport shrinks in lockstep, so the formula naturally computes ~0 and the
   lift disables itself — one code path, no version sniffing.

   GATING: the lift only engages while a text field inside the app actually
   has focus. Without that, pinch-zoom panning (which also moves
   visualViewport.offsetTop) would be misread as a keyboard.

   MOTION: the consumer animates to the reported value with the UIKit
   keyboard timing (see KB_TRANSITION in DiscussApp), so the composer glides
   with the keyboard exactly like WeChat instead of jumping after it.
   ═══════════════════════════════════════════════════════════════════════════ */

/** Keyboards shorter than this are not keyboards (URL-bar retractions,
    pinch pans, scroll bounces all move the viewport by less). */
const MIN_KEYBOARD_PX = 80;

function isTextEntry(el: Element | null): boolean {
  if (!el) return false;
  if (el instanceof HTMLTextAreaElement) return true;
  if (el instanceof HTMLInputElement) {
    const t = (el.type || "text").toLowerCase();
    return !["checkbox", "radio", "button", "submit", "range", "file", "color"].includes(t);
  }
  return el instanceof HTMLElement && el.isContentEditable;
}

function readKeyboardPx(): number {
  const vv = window.visualViewport;
  if (!vv) return 0;
  const covered = window.innerHeight - vv.height - vv.offsetTop;
  return covered >= MIN_KEYBOARD_PX ? Math.round(covered) : 0;
}

export function useKeyboardLift(): number {
  const [kb, setKb] = useState(0);

  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;

    let textFocused = isTextEntry(document.activeElement);

    const update = () => {
      /* No focused text field → whatever the viewport is doing is not a
         keyboard we should ride. */
      if (!textFocused) {
        setKb((prev) => (prev === 0 ? prev : 0));
        return;
      }
      const next = readKeyboardPx();
      setKb((prev) => (prev === next ? prev : next));
    };

    const onFocusIn = (e: FocusEvent) => {
      textFocused = isTextEntry(e.target as Element | null);
      update();
    };
    const onFocusOut = () => {
      textFocused = false;
      update();
    };

    /* `resize` catches the keyboard height changes, `scroll` catches the
       Safari pan (offsetTop) — both feed the same formula. */
    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    document.addEventListener("focusin", onFocusIn);
    document.addEventListener("focusout", onFocusOut);
    update();

    return () => {
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
      document.removeEventListener("focusin", onFocusIn);
      document.removeEventListener("focusout", onFocusOut);
    };
  }, []);

  return kb;
}
