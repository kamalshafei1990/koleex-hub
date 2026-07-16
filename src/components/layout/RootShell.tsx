"use client";

/* ---------------------------------------------------------------------------
   RootShell — client-side wrapper used by the root layout.

   · `/login` and `/auth/*` bypass authentication entirely.
   · Every other route is wrapped in AuthGate + MainHeader + Sidebar.
   · The sidebar provider gives shared state to both Sidebar and MainHeader.
   --------------------------------------------------------------------------- */

import { usePathname } from "next/navigation";
import AuthGate from "@/components/admin/AuthGate";
import MainHeader from "./MainHeader";
import Sidebar from "./Sidebar";
import FloatingPanel from "./FloatingPanel";
import ViewAsBanner from "./ViewAsBanner";
import ReportIssueButton from "@/components/qa/ReportIssueButton";
import { Suspense, useEffect, useLayoutEffect, useRef } from "react";
import QaFocusHighlight from "@/components/qa/QaFocusHighlight";
import ActivityTracker from "@/components/activity/ActivityTracker";
import ServiceWorkerRegistrar from "@/components/pwa/ServiceWorkerRegistrar";
import UpdateWatcher from "@/components/pwa/UpdateWatcher";
import PerfVitals from "@/components/perf/PerfVitals";
import PerfPanelGate from "@/components/perf/PerfPanelGate";
import { DisplayPreferencesApplier } from "@/lib/display-prefs";
import { QAInspectorProvider } from "@/lib/qa/inspector";
import {
  SidebarProvider,
  useSidebar,
  SIDEBAR_EXPANDED_W,
  SIDEBAR_COLLAPSED_W,
} from "./SidebarContext";
import { useMeBootstrap } from "@/lib/me-bootstrap";

const useIsomorphicLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;

function ScrollToTopOnRouteChange() {
  const pathname = usePathname();
  const prevPathRef = useRef(pathname);

  // Re‑apply manual scroll restoration on every pathname change
  useEffect(() => {
    if ("scrollRestoration" in window.history) {
      window.history.scrollRestoration = "manual";
    }
  }, [pathname]);

  // Multi‑layered reset to outrun Next.js router restoration
  useIsomorphicLayoutEffect(() => {
    if (pathname !== prevPathRef.current) {
      const reset = () => {
        const el = document.getElementById("main-scroll-container");
        if (el) el.scrollTo(0, 0);
        window.scrollTo(0, 0);
        document.documentElement.scrollTop = 0;
        document.body.scrollTop = 0;
      };
      // 1️⃣ Synchronous reset
      reset();
      // 2️⃣ Next frame + delayed resets
      requestAnimationFrame(() => {
        reset();
        setTimeout(reset, 50);
        setTimeout(reset, 150);
      });
      prevPathRef.current = pathname;
    }
  }, [pathname]);

  return null;
}

/* Paths that need chrome-less rendering — same treatment as the
   /login + /auth flows but matched anywhere in the URL. Right now
   only the PDF-print routes use this: /quotations/<id>/print and
   /invoices/<id>/print. Server-side PDF generation snapshots these
   pages and the Hub chrome (header, sidebar, panels) must NOT be
   present in the captured output. */
const BYPASS_SUFFIXES = ["/print"];
const BYPASS_PREFIXES = ["/login", "/auth"];

function isBypassed(pathname: string | null): boolean {
  if (!pathname) return false;
  if (
    BYPASS_PREFIXES.some(
      (p) => pathname === p || pathname.startsWith(p + "/"),
    )
  )
    return true;
  return BYPASS_SUFFIXES.some(
    (s) => pathname.endsWith(s) || pathname.endsWith(s + "/"),
  );
}

/** Inner shell that consumes sidebar context for the padding offset. */
function ShellContent({ children }: { children: React.ReactNode }) {
  const { expanded } = useSidebar();
  const pathname = usePathname();
  /* Prime the shared per-user bootstrap once at the top of the authenticated
     shell, so the single GET /api/me/bootstrap starts deterministically here
     instead of depending on which child (header / sidebar / page) mounts first.
     Every consumer shares the same in-flight promise + 60s cache, so this adds
     no extra request — it just fixes the trigger point (was a dead import). */
  useMeBootstrap();
  /* The home launcher already lists every app grouped by category, so the
     persistent sidebar rail there is pure duplication. Hide it on "/" and
     reclaim the horizontal space (full-width launcher). Every inner route
     keeps the rail as global cross-app navigation. */
  const isHome = pathname === "/";
  const desktopPad = isHome
    ? 0
    : expanded
      ? SIDEBAR_EXPANDED_W
      : SIDEBAR_COLLAPSED_W;

  /* Desktop (Electron) shell uses a frameless window (titleBarStyle:
     hiddenInset on macOS), so the macOS traffic-light buttons float over the
     top-left of the web content and cover the KOLEEX logo. The preload exposes
     `window.koleex.isDesktop`; when present we tag <html> so the CSS below
     pushes the fixed header + content down past the title-bar zone and reserves
     a draggable strip. No-op in a normal browser. */
  useEffect(() => {
    const isDesktop = !!(
      window as unknown as { koleex?: { isDesktop?: boolean } }
    ).koleex?.isDesktop;
    if (isDesktop) document.documentElement.classList.add("kx-desktop");
  }, []);

  return (
    <QAInspectorProvider>
      <style>{`
        :root { --kx-titlebar: 0px; --kx-safe-top: env(safe-area-inset-top, 0px); }
        html.kx-desktop { --kx-titlebar: 30px; }
        /* iOS installed PWA (Add to Home Screen): the status bar is
           translucent and the web view renders UNDER it, so the fixed header
           was overlapping the clock / battery / wifi. Grow the header by the
           safe-area inset (its dark bg fills behind the status bar) and push
           the content down to match. env() is 0 on desktop/Android so this is
           a no-op there. */
        .kx-mainheader {
          padding-top: var(--kx-safe-top) !important;
          height: calc(3.5rem + var(--kx-safe-top)) !important;
        }
        .kx-shell-top { padding-top: calc(3.5rem + var(--kx-safe-top)) !important; }
        /* Push the fixed top header down below the macOS traffic lights. */
        html.kx-desktop .kx-mainheader { top: var(--kx-titlebar) !important; height: calc(3.5rem + var(--kx-titlebar)) !important; padding-top: 0 !important; }
        /* Match the content offset so nothing slips under the header. */
        html.kx-desktop .kx-shell-top { padding-top: calc(3.5rem + var(--kx-titlebar)) !important; }
        /* Draggable, transparent strip occupying the reserved title-bar zone. */
        .kx-titlebar-drag { display: none; }
        html.kx-desktop .kx-titlebar-drag {
          display: block; position: fixed; top: 0; left: 0; right: 0;
          height: var(--kx-titlebar); z-index: 300;
          -webkit-app-region: drag; background: var(--bg-primary);
        }
      `}</style>
      <div className="kx-titlebar-drag" aria-hidden />
      <MainHeader />
      {/* Persistent banner shown when a Super Admin is "viewing as"
          another user. Sits below MainHeader (fixed, top-14) and is
          dismissed by clicking "Exit view-as" inside it. Returns null
          when no view-as is active. */}
      <ViewAsBanner />
      <Sidebar />
      {/* pt-14 = header height. The view-as indicator is now a compact floating
          pill (overlay), so it no longer needs to push content down. */}
      <div
        className={`kx-shell-top pt-14 flex-1 flex flex-col min-h-0 h-[calc(100vh-0px)] overflow-hidden transition-all duration-300 ease-in-out`}
        style={{
          /* @ts-ignore — inline style for responsive sidebar offset */
          paddingInlineStart: undefined,
        }}
      >
        {/* CSS media query handles mobile vs desktop sidebar offset.
            We use a wrapper div that gets the padding on md+ breakpoints.
            On mobile the sidebar is an overlay so no offset needed. */}
        <style>{`
          @media (min-width: 768px) {
            .shell-content-offset { padding-inline-start: ${desktopPad}px !important; }
          }
        `}</style>
        <div id="main-scroll-container" className="shell-content-offset flex-1 flex flex-col min-h-0 overflow-auto transition-all duration-300 ease-in-out">
          <ScrollToTopOnRouteChange />
          {children}
        </div>
      </div>
      <FloatingPanel />
      {/* Global QA issue reporter (floating button + modal). */}
      <ReportIssueButton />
      {/* QA Open Route highlighter — reads ?qa_focus=… and outlines the
          picked component on arrival (issue dc295123 follow-up). */}
      <Suspense fallback={null}><QaFocusHighlight /></Suspense>
      {/* Headless presence heartbeat + page tracking (Super Admin monitoring). */}
      <ActivityTracker />
      {/* Registers the push service worker (PWA / Web Push). */}
      <ServiceWorkerRegistrar />
      {/* Detects new deploys and offers a one-tap refresh (PWA cache-bust). */}
      <UpdateWatcher />
      {/* kx-perf bootstrap — cold/warm nav timings, long tasks, online/offline.
          Renders nothing; see docs/performance/OBSERVABILITY_ARCHITECTURE.md. */}
      <PerfVitals />
      {/* Dev-only floating perf panel (zero bytes in production builds). */}
      <PerfPanelGate />
      {/* Applies the user's Appearance / Accessibility / Region prefs to <html>. */}
      <DisplayPreferencesApplier />
    </QAInspectorProvider>
  );
}

export default function RootShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  if (isBypassed(pathname)) {
    return <>{children}</>;
  }

  return (
    <AuthGate title="Koleex Hub" subtitle="Sign in to access the platform">
      <SidebarProvider>
        <ShellContent>{children}</ShellContent>
      </SidebarProvider>
    </AuthGate>
  );
}
