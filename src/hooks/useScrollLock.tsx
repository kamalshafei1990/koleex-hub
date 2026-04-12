"use client";

import { useEffect, type ReactNode } from "react";

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

/** Thin wrapper `<div>` that locks body scroll while mounted.
 *  Drop-in replacement for a plain `<div>` around inline modals
 *  where you can't call a hook (e.g. conditional renders inside a
 *  parent component). All extra props are forwarded to the div. */
export function ScrollLockOverlay({
  children,
  ...rest
}: { children: ReactNode } & React.HTMLAttributes<HTMLDivElement>) {
  useScrollLock();
  return <div {...rest}>{children}</div>;
}
