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
      {/* Loading language (owner pick): Hub Blue sweep bar + shimmer blocks,
          structure static. The bar is the single "working" signal, so the
          old spinner well now shows the DESTINATION app's registry icon
          (warm-started mirror → paints instantly) — you're visually inside
          the app you tapped from the first frame. */}
      <div className="kx-loadbar" />
      <div className="mx-auto max-w-[1200px] px-4 md:px-8 pt-6 md:pt-10">
        {/* App title row — appears instantly, so the tap "did something" */}
        <div className="flex items-center gap-3 mb-6">
          <div className="h-9 w-9 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-subtle)] flex items-center justify-center text-[var(--text-primary)]">
            <BoundIcon
              semanticKey={`app.${appId}`}
              className="h-[18px] w-[18px]"
              fallback={<SpinnerIcon size={15} className="animate-spin text-[var(--text-dim)]" />}
            />
          </div>
          <div className="text-[17px] font-bold text-[var(--text-primary)] tracking-tight">
            {name}
          </div>
        </div>
        {/* Generic app-shaped skeleton — blocks shimmer, lines stay still */}
        <div className="space-y-3">
          <div className="kx-shimmer h-10 w-full max-w-[560px] rounded-xl bg-[var(--bg-secondary)]" />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="kx-shimmer h-24 rounded-2xl bg-[var(--bg-secondary)]" />
            ))}
          </div>
          <div className="kx-shimmer h-64 rounded-2xl bg-[var(--bg-secondary)] mt-2" />
        </div>
      </div>
    </div>
  );
}
