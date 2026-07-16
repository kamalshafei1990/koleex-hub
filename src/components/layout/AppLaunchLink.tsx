"use client";

/* ---------------------------------------------------------------------------
   AppLaunchLink — the ONE shared app-launch primitive for every primary entry
   surface (Home cards, sidebar, launcher, future palette).
   (Phase 4 — Home & App Launch Performance)

   Consolidates the previously-fragmented launch behavior (Home used
   router.push with no modifier-key / pressed-feedback; sidebar used a bare
   <Link> with no telemetry) into one component that gives every surface:

     · Real navigation via Next <Link> → automatic viewport route-code
       prefetch, and native modifier-key / middle-click / "open in new tab"
       and keyboard (Enter + Space) support that router.push cannot provide.
     · Immediate PRESSED feedback (CSS :active scale) — < 100 ms, no JS,
       reduced-motion-safe.
     · Intent preload on hover / focus / touch (router.prefetch + optional
       app-specific data warm via onPreload), gated by network/device safety.
     · Unified, privacy-safe launch telemetry (recent-app + app_launch metric),
       fired ONCE per activation, only for a real same-tab launch.
     · Duplicate-activation guard.
     · Disabled / unauthorized state → renders a non-interactive element with
       NO href and NO prefetch (an unauthorized route is never prefetched).

   It is presentation-agnostic: callers pass their own className + children
   (the card or the row visual). Permission/authorization is decided by the
   CALLER (it already filters by permitted modules); this component only refuses
   to launch inactive/disabled apps — it never widens access.
   --------------------------------------------------------------------------- */

import Link from "next/link";
import { useCallback, useRef } from "react";
import type { AppDef } from "@/lib/navigation";
import { trackAppOpen } from "@/lib/app-launcher";
import { markAppLaunch } from "@/lib/perf/client";
import { prefetchTier, readNetworkContext, isPreloadAllowed } from "@/lib/app-prefetch";

export interface AppLaunchLinkProps {
  app: AppDef;
  className?: string;
  children: React.ReactNode;
  /** App-specific warm callback fired on hover/focus/touch intent (e.g. warm
      the app's list GET). Called at most once per mount. */
  onPreload?: (app: AppDef) => void;
  /** Fired on activation AFTER telemetry (e.g. close the mobile sidebar). Does
      not affect navigation. */
  onNavigate?: () => void;
  /** Force-disable even if the app is active (e.g. an unauthorized tile the
      caller still wants to render greyed out). */
  disabled?: boolean;
  /** Add the built-in pressed-scale feedback (default true). */
  pressFeedback?: boolean;
  title?: string;
  "aria-label"?: string;
  "aria-current"?: React.AriaAttributes["aria-current"];
  tabIndex?: number;
  role?: string;
}

export default function AppLaunchLink({
  app,
  className = "",
  children,
  onPreload,
  onNavigate,
  disabled,
  pressFeedback = true,
  title,
  tabIndex,
  role,
  ...aria
}: AppLaunchLinkProps) {
  const inactive = !app.active || disabled;
  const preloadedRef = useRef(false);
  const pressAtRef = useRef<number | null>(null);
  const lastLaunchRef = useRef(0);

  const press =
    pressFeedback && !inactive
      ? " transition-transform duration-75 active:scale-[0.97] motion-reduce:transition-none motion-reduce:active:scale-100 touch-manipulation"
      : "";

  const doPreload = useCallback(() => {
    if (inactive || preloadedRef.current) return;
    if (!isPreloadAllowed(readNetworkContext())) return; // Save-Data / slow / hidden / offline
    if (prefetchTier(app.id) === "C") return; // heavy/rare: no intent preload either
    preloadedRef.current = true;
    try { onPreload?.(app); } catch { /* warm is best-effort */ }
  }, [inactive, app, onPreload]);

  const onPointerDown = useCallback(() => {
    if (typeof performance !== "undefined") pressAtRef.current = performance.now();
  }, []);

  const onClick = useCallback(
    (e: React.MouseEvent) => {
      if (inactive) { e.preventDefault(); return; }
      // Let the browser handle new-tab / modifier / middle-click natively —
      // record the recent-app open but do NOT start the same-tab launch timer
      // (no in-tab navigation happens).
      const modified = e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || (e as React.MouseEvent).button === 1;
      try { trackAppOpen("", app.id); } catch { /* best-effort */ }
      try { onNavigate?.(); } catch { /* best-effort */ }
      if (modified) return;
      // Duplicate-activation guard: ignore a second plain launch within 400 ms.
      const now = typeof performance !== "undefined" ? performance.now() : Date.now();
      if (now - lastLaunchRef.current < 400) return;
      lastLaunchRef.current = now;
      const pressMs = pressAtRef.current != null ? now - pressAtRef.current : 0;
      markAppLaunch(app.id, pressMs);
    },
    [inactive, app.id, onNavigate],
  );

  if (inactive) {
    return (
      <div className={className} aria-disabled title={title} role={role} tabIndex={-1} {...aria}>
        {children}
      </div>
    );
  }

  // Tier C: don't auto-prefetch heavy routes on viewport-enter; still prefetch
  // on explicit hover/focus intent (handled by doPreload → onPreload can call
  // router.prefetch). Save-Data also disables auto-prefetch.
  const net = typeof navigator !== "undefined" ? readNetworkContext() : null;
  const autoPrefetch = prefetchTier(app.id) === "C" || (net && !isPreloadAllowed(net)) ? false : undefined;

  return (
    <Link
      href={app.route}
      prefetch={autoPrefetch}
      className={`${className}${press}`}
      title={title}
      role={role}
      tabIndex={tabIndex}
      onClick={onClick}
      onPointerDown={onPointerDown}
      onPointerEnter={doPreload}
      onFocus={doPreload}
      onTouchStart={doPreload}
      {...aria}
    >
      {children}
    </Link>
  );
}
