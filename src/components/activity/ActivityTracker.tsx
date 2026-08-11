"use client";

/* ---------------------------------------------------------------------------
   ActivityTracker — headless presence + page tracking.

   Mounted once inside the authenticated shell. Responsibilities:
     · Heartbeat the live-presence row (adaptive cadence: 30s active, 120s idle/hidden) (and on tab focus).
     · Track page views on route change (debounced).
     · Detect idle (no input for IDLE_MS) → status "idle"; resume → "active".
     · On tab close / navigation away → sendBeacon a session_end + offline.
     · If the server reports the session was admin-revoked, force a sign-out.

   Writes are cheap and throttled; nothing here blocks rendering. All network
   calls are best-effort and silently ignored on failure. Renders nothing.
   --------------------------------------------------------------------------- */

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { getDeviceId } from "@/lib/activity/device-id";
import { routeToModule } from "@/lib/activity/modules";

/* SW-2 (Phase 4): adaptive heartbeat cadence. An active, visible user still
   pings every 30s (accurate presence + 30s revocation detection). An IDLE or
   HIDDEN tab slows to 120s — it isn't doing anything, so 30s precision buys
   nothing, and this cuts idle/backgrounded heartbeat writes ~4×. Safety is
   preserved: we still ping (never false-offline), we ping IMMEDIATELY on
   return-to-visible (instant revocation + presence on resume), and the
   force-logout `revoked` signal still arrives — just at a bounded slower
   cadence for users who aren't interacting. */
const HEARTBEAT_ACTIVE_MS = 30_000; // visible + recent input
const HEARTBEAT_SLOW_MS = 120_000;  // idle OR hidden
const IDLE_MS = 60_000; // no input → idle

export default function ActivityTracker() {
  const pathname = usePathname();
  const pathRef = useRef(pathname);
  const statusRef = useRef<"active" | "idle">("active");
  const lastInputRef = useRef(Date.now());
  const lastTrackedPath = useRef<string | null>(null);

  // Keep the latest pathname available to interval/listeners without re-binding.
  useEffect(() => {
    pathRef.current = pathname;
  }, [pathname]);

  /* ── Heartbeat + idle loop ── */
  useEffect(() => {
    const deviceId = getDeviceId();
    let stopped = false;

    const sendHeartbeat = async () => {
      if (stopped) return;
      const idle = Date.now() - lastInputRef.current > IDLE_MS;
      statusRef.current = idle ? "idle" : "active";
      const route = pathRef.current || "/";
      try {
        const res = await fetch("/api/activity/heartbeat", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            deviceId,
            route,
            module: routeToModule(route),
            status: statusRef.current,
          }),
        });
        if (res.ok) {
          const json = (await res.json().catch(() => ({}))) as { revoked?: boolean };
          // Admin force-logout: the presence row was revoked → sign out.
          if (json.revoked) {
            stopped = true;
            /* The root shows the sign-in form. `?revoked=1` went with the
               deleted /login page — nothing ever read it. */
            window.location.href = "/";
          }
        }
      } catch {
        /* offline / transient — try again next tick */
      }
    };

    // Mark input → resets idle timer.
    const onInput = () => {
      lastInputRef.current = Date.now();
    };
    const events: Array<keyof WindowEventMap> = [
      "mousedown",
      "keydown",
      "touchstart",
      "scroll",
      "mousemove",
    ];
    events.forEach((e) => window.addEventListener(e, onInput, { passive: true }));

    /* Self-scheduling loop so the cadence can adapt each tick: fast while the
       user is visible + active, slow while idle or hidden. */
    let timer: number | undefined;
    const nextDelay = () => {
      const hidden = typeof document !== "undefined" && document.visibilityState === "hidden";
      const idle = Date.now() - lastInputRef.current > IDLE_MS;
      return hidden || idle ? HEARTBEAT_SLOW_MS : HEARTBEAT_ACTIVE_MS;
    };
    const loop = async () => {
      if (stopped) return;
      await sendHeartbeat();
      if (stopped) return;
      timer = window.setTimeout(loop, nextDelay());
    };
    /* THE FIRST BEAT WAITS FOR THE SCREEN.

       Measured on prod (2026-08-11): opening Product Data fires 10 API calls
       in the same instant and the last one lands at 4.08s — on this link
       concurrent requests block each other, so six of Home's eight shared an
       identical 1342ms TTFB. Presence is background work: nothing on screen
       waits for it, so it must not compete with the data that is.

       Idle callback with a 3s ceiling, so it still starts promptly on a busy
       page. The revocation check rides this beat, but the normal cadence is
       already 30s — a few seconds later on the first one changes nothing. */
    const startBeats = () => { void loop(); };
    const ric = (window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number }).requestIdleCallback;
    let startTimer: number | undefined;
    if (ric) ric(startBeats, { timeout: 3000 });
    else startTimer = window.setTimeout(startBeats, 1500);

    /* The catch-up ping is THROTTLED. Coming back to the tab fires an
       immediate beat, which is right for a real return — but a user flicking
       between apps, or any environment that toggles visibility rapidly, then
       gets one request per toggle. Observed while instrumenting: 12
       visibility flips in 12 seconds produced 12 heartbeats. One beat per
       RESUME_MIN_MS is all the revocation check needs. */
    let lastBeatAt = 0;
    const RESUME_MIN_MS = 10_000;
    const onVisible = () => {
      if (document.visibilityState === "visible") {
        lastInputRef.current = Date.now();
        if (timer !== undefined) window.clearTimeout(timer);
        if (Date.now() - lastBeatAt >= RESUME_MIN_MS) {
          lastBeatAt = Date.now();
          void sendHeartbeat();
        }
        timer = window.setTimeout(loop, HEARTBEAT_ACTIVE_MS);
      }
    };
    document.addEventListener("visibilitychange", onVisible);

    // On unload: best-effort offline marker via sendBeacon (survives teardown).
    const onLeave = () => {
      try {
        const payload = JSON.stringify({
          deviceId,
          eventType: "session_end",
          route: pathRef.current || "/",
        });
        navigator.sendBeacon?.("/api/activity/track", new Blob([payload], { type: "application/json" }));
      } catch {
        /* ignore */
      }
    };
    window.addEventListener("pagehide", onLeave);

    return () => {
      stopped = true;
      if (timer !== undefined) window.clearTimeout(timer);
      if (startTimer !== undefined) window.clearTimeout(startTimer);
      events.forEach((e) => window.removeEventListener(e, onInput));
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("pagehide", onLeave);
    };
  }, []);

  /* ── Page-view tracking on route change (debounced) ── */
  useEffect(() => {
    if (!pathname) return;
    if (lastTrackedPath.current === pathname) return;
    const deviceId = getDeviceId();
    const referrer = lastTrackedPath.current;
    lastTrackedPath.current = pathname;
    const t = window.setTimeout(() => {
      void fetch("/api/activity/track", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          deviceId,
          eventType: "page_view",
          route: pathname,
          // The document title is the same global string on every page, so we
          // don't store it — the feed labels page views by module instead.
          title: null,
          referrer,
        }),
      }).catch(() => {});
    }, 400);
    return () => window.clearTimeout(t);
  }, [pathname]);

  return null;
}
