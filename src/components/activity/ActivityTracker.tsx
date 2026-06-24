"use client";

/* ---------------------------------------------------------------------------
   ActivityTracker — headless presence + page tracking.

   Mounted once inside the authenticated shell. Responsibilities:
     · Heartbeat the live-presence row every HEARTBEAT_MS (and on tab focus).
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

const HEARTBEAT_MS = 30_000; // presence ping cadence
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
            window.location.href = "/login?revoked=1";
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

    // Heartbeat now, then on an interval. Also ping when the tab regains focus.
    void sendHeartbeat();
    const interval = window.setInterval(sendHeartbeat, HEARTBEAT_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") {
        lastInputRef.current = Date.now();
        void sendHeartbeat();
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
      window.clearInterval(interval);
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
          title: typeof document !== "undefined" ? document.title : null,
          referrer,
        }),
      }).catch(() => {});
    }, 400);
    return () => window.clearTimeout(t);
  }, [pathname]);

  return null;
}
