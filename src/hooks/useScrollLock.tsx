"use client";

import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

/** Lock body scroll while the calling component is mounted.
 *  Supports nested modals — keeps a ref-count so the lock is only
 *  released when the last consumer unmounts. */
let lockCount = 0;

export function useScrollLock() {
  useEffect(() => {
    lockCount += 1;
    if (lockCount === 1) {
      document.body.style.overflow = "hidden";
    }
    return () => {
      lockCount -= 1;
      if (lockCount === 0) {
        document.body.style.overflow = "";
      }
    };
  }, []);
}

/** Full-screen modal overlay that locks body scroll while mounted.
 *
 *  Rendered through a PORTAL onto <body>, for two reasons:
 *  1. Apps render inside #main-scroll-container; an ancestor with a
 *     transform/filter turns position:fixed into "fixed to that box",
 *     so inline overlays could end up clipped or misplaced.
 *  2. MainHeader is fixed at z-[100]; inline overlays at z-50 painted
 *     UNDER it (the "modal top hidden behind the header" bug). The
 *     portal renders at body level with zIndex 110 (inline style, so
 *     it wins over any z-* utility passed in className).
 *
 *  All extra props are forwarded to the overlay div. */
export function ScrollLockOverlay({
  children,
  ...rest
}: { children: ReactNode } & React.HTMLAttributes<HTMLDivElement>) {
  useScrollLock();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;

  /* THE BLUR MOVES OFF THIS DIV AND ONTO A SIBLING OF THE CHILDREN.
     A `backdrop-filter` ANCESTOR starves its descendants: the child samples
     the parent's already-filtered layer instead of the page, so its own glass
     has nothing left to work on. Callers pass `backdrop-blur-md` here and then
     wrap a `.kx-glass-pop` card inside — measured on the New Contact dialog:
     the card asked for blur(40px) saturate(1.5) and rendered as a flat panel,
     which is why it still read as the pre-Aurora design.

     Dropdown panels never had this because their scrim is a SIBLING, not an
     ancestor. Same shape here: strip the blur token off the container and
     paint it on an inset layer behind the children. The dim stays on the
     container, so nothing about the look changes except that the glass now
     has a real backdrop to sample. */
  const cls = rest.className ?? "";
  const hasBlur = /(?:^|\s)backdrop-blur-/.test(cls);
  const containerCls = hasBlur ? cls.replace(/(?:^|\s)backdrop-blur-[\w[\]/.-]+/g, " ").replace(/\s+/g, " ").trim() : cls;

  return createPortal(
    <div {...rest} className={containerCls} style={{ zIndex: 110, ...(rest.style ?? {}) }}>
      {hasBlur && (
        /* blur-SM, not whatever the caller asked for. Callers said `md` (12px),
           which mashes the page into a smear — nothing with shape survives for
           the card's glass to pick up. The dropdown scrims use 4px and read as
           glass, so modals use 4px too. */
        <div aria-hidden className="absolute inset-0 backdrop-blur-sm" style={{ zIndex: -1 }} />
      )}
      {children}
    </div>,
    document.body,
  );
}
