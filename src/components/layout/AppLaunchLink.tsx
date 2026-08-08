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

import Link, { useLinkStatus } from "next/link";
import { useCallback, useRef } from "react";
import type { AppDef } from "@/lib/navigation";
import { trackAppOpen } from "@/lib/app-launcher";
import { markAppLaunch } from "@/lib/perf/client";
import { prefetchTier, readNetworkContext, isPreloadAllowed } from "@/lib/app-prefetch";
import { preloadAppChunk, wasChunkWarmed } from "@/lib/app-chunk-preload";

/* Renders INSIDE the <Link>: while the navigation this link started is still
   in flight (RSC payload / chunk on a slow network), the tile itself speaks
   the Hub loading language (owner call 2026-08-08 — he pointed at the old
   floating corner spinner): a soft Hub Blue inner ring + a thin sweep bar
   along the tile's bottom edge — the same bar that then appears on the
   splash and the destination page, so press → splash → page reads as ONE
   continuous thread. 150 ms delay so instant navigations never flash. */
function LaunchPendingOverlay() {
  const { pending } = useLinkStatus();
  if (!pending) return null;
  return (
    <span
      aria-hidden
      className="absolute inset-0 z-10 overflow-hidden rounded-[inherit] opacity-0 [animation:kx-launch-pending_.15s_.15s_forwards]"
    >
      <span className="absolute inset-0 rounded-[inherit] bg-[var(--bg-primary)]/30" />
      <span className="absolute inset-0 rounded-[inherit] ring-1 ring-inset ring-[#7FA9D6]/50 shadow-[inset_0_0_18px_rgba(86,127,178,0.28)]" />
      <span className="kx-loadbar kx-loadbar-bottom" />
      <style>{`@keyframes kx-launch-pending { to { opacity: 1; } }`}</style>
    </span>
  );
}

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
    // Warm the REAL client app chunk on intent (route prefetch only warms the
    // RSC shell) so the first launch of a heavy app isn't a multi-second chunk
    // download. Deduped + network-gated inside preloadAppChunk.
    /* force: this fires on INTENT (hover / focus on the tile), so the user
       has aimed at this app — paying for its chunk is what they asked for,
       even on a slow link. The idle warm on Home stays gated. */
    try { preloadAppChunk(app.id, { force: true }); } catch { /* best-effort */ }
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
      /* A newer deploy is live (UpdateWatcher raised the flag): turn this
         launch into a FULL document navigation so the user rides onto the
         fresh bundle as part of a navigation they were making anyway.

         ONCE PER BUILD, not on a time window. A stale tab's chunk URLs are
         already gone from the server, so a soft navigation 404s and the App
         Router recovers by reloading the CURRENT url — which is still "/"
         because the URL only changes once a navigation commits. That is
         exactly the "I open an app, it waits, then throws me back to Home
         and I have to go in again" the owner reported; the previous 10-minute
         throttle made it MORE likely by letting stale taps take the soft
         path. Keying on the build id gives every client exactly one full
         load per deploy — the moment it is needed, and never again. */
      const g = globalThis as typeof globalThis & {
        __kxStaleBuild?: boolean;
        __kxStaleBuildId?: string;
      };
      if (g.__kxStaleBuild) {
        const target = g.__kxStaleBuildId ?? "unknown";
        let healed = "";
        try { healed = window.localStorage.getItem("kx_healed_build") ?? ""; } catch { /* ignore */ }
        if (healed !== target) {
          try { window.localStorage.setItem("kx_healed_build", target); } catch { /* ignore */ }
          e.preventDefault();
          window.location.assign(app.route);
          return;
        }
      }
      // Duplicate-activation guard: ignore a second plain launch within 400 ms.
      const now = typeof performance !== "undefined" ? performance.now() : Date.now();
      if (now - lastLaunchRef.current < 400) return;
      lastLaunchRef.current = now;
      const pressMs = pressAtRef.current != null ? now - pressAtRef.current : 0;
      // Classify cold (chunk not yet warmed → pays the download) vs warm.
      markAppLaunch(app.id, pressMs, !wasChunkWarmed(app.id));
      // Tell the launch splash a same-tab app launch just started — it takes
      // over the screen if the route doesn't arrive almost immediately.
      try {
        window.dispatchEvent(new CustomEvent("kx:app-launch", { detail: { appId: app.id, route: app.route } }));
      } catch { /* best-effort */ }
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

  /* FULL payload prefetch for every visible tile. The RSC payload of these
     static app shells is a few KB — prefetching it is what makes the FIRST
     tap swap instantly instead of paying a full round-trip (1-3s from
     mainland China). Only genuinely constrained networks (Save-Data,
     2g/slow-2g, offline) opt out. The heavy client CHUNK is warmed
     separately (idle warm-all + intent preload). */
  const net = typeof navigator !== "undefined" ? readNetworkContext() : null;
  const autoPrefetch = net && !isPreloadAllowed(net) ? false : true;

  return (
    <Link
      href={app.route}
      prefetch={autoPrefetch}
      className={`relative ${className}${press}`}
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
      <LaunchPendingOverlay />
    </Link>
  );
}
