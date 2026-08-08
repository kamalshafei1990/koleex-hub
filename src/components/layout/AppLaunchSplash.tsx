"use client";

/* ---------------------------------------------------------------------------
   AppLaunchSplash — native-app launch feel for slow links.

   When the user taps an app tile and the route hasn't arrived within 120 ms
   (typical on high-latency links: mainland China → Vercel), this takes over
   the content area INSTANTLY with the Hub's one loading moment, so the tap
   always visibly does something — no dead screen, no double-tap confusion.

   · Listens for `kx:app-launch` (dispatched by AppLaunchLink on every plain
     same-tab launch).
   · 120 ms grace so genuinely instant swaps (prefetched payload) never flash.
   · Hides on pathname change (the real page + its loading.tsx take over,
     visually seamless — both render the same BrandLoading) or a 15 s safety.
   · Sits below the main header (var(--kx-header-h)) so the chrome stays put.
   · Owner call 2026-08-08: the splash shows ONLY the brand moment — no app
     name, no spinner. Same picture as every other gate.
   --------------------------------------------------------------------------- */

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import BrandLoading from "@/components/ui/BrandLoading";
import { ensureLoadProgressPatch } from "@/lib/load-progress";

const SHOW_AFTER_MS = 120;
const SAFETY_MS = 15_000;

/* Warm the loading-language lockups ONCE at boot. /public assets ship with
   max-age=0 (revalidate every time — ~1s over the China link), so without
   this the loader's own logo used to arrive AFTER the loading moment it was
   supposed to fill. Combined with the SW image cache they're then instant
   for the life of the install. */
if (typeof window !== "undefined") {
  for (const v of ["dark", "light"]) {
    const img = new Image();
    img.src = `/brand/hub-logo/koleex-hub-logo-for-${v}.webp`;
  }
  /* Install the request counter with the FIRST module of the shell, not
     with the first loading surface: screens fire their data fetches the
     moment they mount, and a patch that arrives one effect later misses
     them — that was the "no percentage in most apps" bug. */
  ensureLoadProgressPatch();
}

export default function AppLaunchSplash() {
  const pathname = usePathname();
  const [visible, setVisible] = useState(false);
  const showTimerRef = useRef<number | null>(null);
  const safetyRef = useRef<number | null>(null);

  useEffect(() => {
    const onLaunch = (e: Event) => {
      const { appId, route } = (e as CustomEvent<{ appId: string; route: string }>).detail ?? {};
      if (!appId || !route) return;
      if (route.split(/[?#]/)[0] === window.location.pathname) return;
      if (showTimerRef.current) window.clearTimeout(showTimerRef.current);
      showTimerRef.current = window.setTimeout(() => setVisible(true), SHOW_AFTER_MS);
      if (safetyRef.current) window.clearTimeout(safetyRef.current);
      safetyRef.current = window.setTimeout(() => setVisible(false), SAFETY_MS);
    };
    window.addEventListener("kx:app-launch", onLaunch);
    return () => window.removeEventListener("kx:app-launch", onLaunch);
  }, []);

  /* Route arrived → clear immediately (the destination's own shell renders). */
  useEffect(() => {
    if (showTimerRef.current) window.clearTimeout(showTimerRef.current);
    if (safetyRef.current) window.clearTimeout(safetyRef.current);
    setVisible(false);
  }, [pathname]);

  if (!visible) return null;

  return (
    <div
      aria-hidden
      className="fixed inset-x-0 bottom-0 z-[90] bg-[var(--bg-primary)]"
      style={{ top: "var(--kx-header-h, 3.5rem)" }}
    >
      <BrandLoading className="h-full" />
    </div>
  );
}
