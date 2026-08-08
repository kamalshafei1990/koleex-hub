"use client";

/* ---------------------------------------------------------------------------
   AppLaunchSplash — native-app launch feel for slow links.

   When the user taps an app tile and the route hasn't arrived within 120 ms
   (typical on high-latency links: mainland China → Vercel), this takes over
   the content area INSTANTLY with the destination app's shell: its name, an
   app-shaped skeleton and a spinner. The user is visually "inside" the app
   from the moment they tap — no dead screen, no double-tap confusion.

   · Listens for `kx:app-launch` (dispatched by AppLaunchLink on every plain
     same-tab launch).
   · 120 ms grace so genuinely instant swaps (prefetched payload) never flash.
   · Hides on pathname change (the real page + its loading.tsx take over,
     visually seamless — both are bg-primary shells) or a 15 s safety.
   · Sits below the main header (var(--kx-header-h)) so the chrome stays put.
   --------------------------------------------------------------------------- */

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { useTranslation } from "@/lib/i18n";
import { hubT } from "@/lib/translations/hub";
import { APP_REGISTRY } from "@/lib/navigation";
import BoundIcon from "@/components/common/BoundIcon";
import SpinnerIcon from "@/components/icons/ui/SpinnerIcon";

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
}

export default function AppLaunchSplash() {
  const pathname = usePathname();
  const { t } = useTranslation(hubT);
  const [appId, setAppId] = useState<string | null>(null);
  const showTimerRef = useRef<number | null>(null);
  const safetyRef = useRef<number | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onLaunch = (e: Event) => {
      const { appId: id, route } = (e as CustomEvent<{ appId: string; route: string }>).detail ?? {};
      if (!id || !route) return;
      if (route.split(/[?#]/)[0] === window.location.pathname) return;
      setAppId(id);
      if (showTimerRef.current) window.clearTimeout(showTimerRef.current);
      showTimerRef.current = window.setTimeout(() => setVisible(true), SHOW_AFTER_MS);
      if (safetyRef.current) window.clearTimeout(safetyRef.current);
      safetyRef.current = window.setTimeout(() => {
        setVisible(false);
        setAppId(null);
      }, SAFETY_MS);
    };
    window.addEventListener("kx:app-launch", onLaunch);
    return () => window.removeEventListener("kx:app-launch", onLaunch);
  }, []);

  /* Route arrived → clear immediately (the destination's own shell renders). */
  useEffect(() => {
    if (showTimerRef.current) window.clearTimeout(showTimerRef.current);
    if (safetyRef.current) window.clearTimeout(safetyRef.current);
    setVisible(false);
    setAppId(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  if (!visible || !appId) return null;
  const app = APP_REGISTRY.find((a) => a.id === appId);
  const name = app?.tKey ? t(app.tKey) : "";

  return (
    <div
      aria-hidden
      className="fixed inset-x-0 bottom-0 z-[90] bg-[var(--bg-primary)]"
      style={{ top: "var(--kx-header-h, 3.5rem)" }}
    >
      {/* Loading language v2 (owner pick, motion sample "B — logo breath"):
          the KOLEEX hub lockup breathing + light-sweep underline — the same
          brand moment every route loading.tsx shows, so splash → page is one
          continuous surface. Destination app's name (and its registry icon,
          instant via the warm mirror) sit under it so the tap still visibly
          "did something" specific. */}
      <div className="kx-brand-load">
        {/* eslint-disable-next-line @next/next/no-img-element -- 17KB webp */}
        <img src="/brand/hub-logo/koleex-hub-logo-for-dark.webp" alt="" className="kx-brand-logo-dark" />
        {/* eslint-disable-next-line @next/next/no-img-element -- theme twin */}
        <img src="/brand/hub-logo/koleex-hub-logo-for-light.webp" alt="" className="kx-brand-logo-light" />
        <div className="kx-brand-underline" />
        <div className="flex items-center gap-2 text-[var(--text-dim)]">
          <BoundIcon
            semanticKey={`app.${appId}`}
            className="h-[15px] w-[15px]"
            fallback={<SpinnerIcon size={13} className="animate-spin" />}
          />
          <span className="text-[13px] font-medium tracking-tight">{name}</span>
        </div>
      </div>
    </div>
  );
}
