"use client";

/* ---------------------------------------------------------------------------
   PerfVitals — invisible bootstrap for the kx-perf client instrumentation.
   Mounted once in RootShell. Renders nothing; wires:
     · initPerf(): cold-load timings, long tasks, online/offline, batching
     · warm route-navigation timing: a capture-phase click listener marks the
       start when an internal <a> link is pressed; the usePathname() effect
       completes the measurement when the route actually changes.
   Overhead: one listener + one effect. No visual or behavioral change.
   --------------------------------------------------------------------------- */

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { initPerf, markNavStart, completeNav } from "@/lib/perf/client";

export default function PerfVitals() {
  const pathname = usePathname();
  const first = useRef(true);

  useEffect(() => {
    initPerf();
    const onClick = (e: MouseEvent) => {
      try {
        const a = (e.target as Element | null)?.closest?.('a[href^="/"]');
        if (a) markNavStart(window.location.pathname);
      } catch { /* never break clicks */ }
    };
    document.addEventListener("click", onClick, { capture: true, passive: true });
    return () => document.removeEventListener("click", onClick, { capture: true });
  }, []);

  useEffect(() => {
    /* Skip the initial mount — that's the cold load, measured separately. */
    if (first.current) { first.current = false; return; }
    completeNav(pathname ?? "/");
  }, [pathname]);

  return null;
}
