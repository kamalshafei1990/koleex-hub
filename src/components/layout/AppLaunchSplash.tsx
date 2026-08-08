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
     visually seamless — both render the same BrandLoading).
   · Sits below the main header (var(--kx-header-h)) so the chrome stays put.
   · Owner call 2026-08-08: the splash shows ONLY the brand moment — no app
     name, no spinner. Same picture as every other gate.

   THE BOUNCE-TO-HOME BUG (owner reported it four times; my first three fixes
   were aimed at the wrong mechanism, so it survived all of them):

   This splash is a `fixed` layer painted OVER whatever page the user is
   standing on — which, on a launch, is Home. The safety timer used to do
   `setVisible(false)` at 15s. So on a slow launch the timer fired before the
   route arrived, the layer vanished, and HOME WAS REVEALED. Then the route
   finally committed and the destination's own loading.tsx drew the same brand
   moment again. That is the exact sequence he kept describing — "it takes me
   out to home page, shows the app loading, then takes me into the app" — and
   it only ever happened when the launch was slow, which is exactly the
   condition he always stated.

   The rule now: this layer NEVER uncovers the page behind it mid-launch. It
   goes away when the destination arrives, and nothing else. If the navigation
   has genuinely not arrived in time, we recover FORWARD with a document load
   to the target the user asked for — never backward to where they were.
   --------------------------------------------------------------------------- */

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import BrandLoading from "@/components/ui/BrandLoading";
import { ensureLoadProgressPatch } from "@/lib/load-progress";

const SHOW_AFTER_MS = 120;
/* 15s was also simply too short for the link this runs on: a measured
   first-wave on /product-data is ~7s, and a cold app chunk on a bad mainland
   connection goes past that. Now it is the deadline for giving up on the SOFT
   navigation and doing a real one — not a deadline for showing the user
   whatever is underneath. */
const RECOVER_AFTER_MS = 20_000;

/* A stale tab's chunk URLs are already 404 on the server. Next's App Router
   recovers from that by reloading the CURRENT url — which is still Home,
   because a URL only changes once its navigation commits. Same visible
   symptom, different cause, so it needs catching too: recover to the launch
   target instead of letting the router reload the page behind us. */
const CHUNK_ERROR_RE =
  /ChunkLoadError|Loading chunk \S+ failed|Failed to fetch dynamically imported module|error loading dynamically imported module|Importing a module script failed/i;

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
  /* fullPage = this launch is a real document load. The browser keeps the OLD
     page painted until the new one commits, so we must cover the header too
     and show INSTANTLY — otherwise the user watches the page he just left
     (on Home that reads as "it threw me back to Home"). */
  const [fullPage, setFullPage] = useState(false);
  const showTimerRef = useRef<number | null>(null);
  const safetyRef = useRef<number | null>(null);
  /* Where this launch was headed. Both recovery paths need it, because the
     whole point is to finish the journey rather than abandon it. */
  const targetRef = useRef<string | null>(null);

  useEffect(() => {
    /* Leave the covering layer up and take the document to the target. The
       browser keeps the current painting until the new document commits, so
       the user keeps seeing the brand moment — never the page behind it. */
    const recoverForward = () => {
      const target = targetRef.current;
      if (!target) return;
      if (target.split(/[?#]/)[0] === window.location.pathname) return;
      targetRef.current = null;
      setFullPage(true);
      setVisible(true);
      window.location.assign(target);
    };

    const onLaunch = (e: Event) => {
      const { appId, route, fullPage: full } =
        (e as CustomEvent<{ appId: string; route: string; fullPage?: boolean }>).detail ?? {};
      if (!appId || !route) return;
      if (route.split(/[?#]/)[0] === window.location.pathname) return;
      targetRef.current = route;
      if (showTimerRef.current) window.clearTimeout(showTimerRef.current);
      if (full) {
        setFullPage(true);
        setVisible(true);
      } else {
        showTimerRef.current = window.setTimeout(() => setVisible(true), SHOW_AFTER_MS);
      }
      if (safetyRef.current) window.clearTimeout(safetyRef.current);
      safetyRef.current = window.setTimeout(recoverForward, RECOVER_AFTER_MS);
    };

    /* A failed chunk during a launch: get ahead of the App Router's own
       recovery, which reloads the page we are standing on. */
    const onWindowError = (e: ErrorEvent) => {
      if (!targetRef.current) return;
      if (!CHUNK_ERROR_RE.test(e.message || "")) return;
      recoverForward();
    };
    const onRejection = (e: PromiseRejectionEvent) => {
      if (!targetRef.current) return;
      const reason = e.reason as { name?: string; message?: string } | string | undefined;
      const text =
        typeof reason === "string" ? reason : `${reason?.name ?? ""} ${reason?.message ?? ""}`;
      if (!CHUNK_ERROR_RE.test(text)) return;
      recoverForward();
    };

    window.addEventListener("kx:app-launch", onLaunch);
    window.addEventListener("error", onWindowError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      window.removeEventListener("kx:app-launch", onLaunch);
      window.removeEventListener("error", onWindowError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, []);

  /* Route arrived → clear immediately (the destination's own shell renders). */
  useEffect(() => {
    if (showTimerRef.current) window.clearTimeout(showTimerRef.current);
    if (safetyRef.current) window.clearTimeout(safetyRef.current);
    targetRef.current = null;
    setVisible(false);
  }, [pathname]);

  if (!visible) return null;

  return (
    <div
      aria-hidden
      className={`fixed inset-x-0 bottom-0 bg-[var(--bg-primary)] ${fullPage ? "z-[999]" : "z-[90]"}`}
      style={{ top: fullPage ? 0 : "var(--kx-header-h, 3.5rem)" }}
    >
      <BrandLoading className="h-full overflow-hidden" />
    </div>
  );
}
