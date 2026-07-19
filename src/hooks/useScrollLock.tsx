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
  return createPortal(
    <div {...rest} style={{ zIndex: 110, ...(rest.style ?? {}) }}>
      {children}
    </div>,
    document.body,
  );
}
