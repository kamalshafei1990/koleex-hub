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
import { QAInspectorProvider } from "@/lib/qa/inspector";
import {
  SidebarProvider,
  useSidebar,
  SIDEBAR_EXPANDED_W,
  SIDEBAR_COLLAPSED_W,
} from "./SidebarContext";
import { useMeBootstrap } from "@/lib/me-bootstrap";

const BYPASS_PREFIXES = ["/login", "/auth"];

/* Paths that need chrome-less rendering — same treatment as the
   /login + /auth flows but matched anywhere in the URL. Right now
   only the PDF-print routes use this: /quotations/<id>/print and
   /invoices/<id>/print. Server-side PDF generation snapshots these
   pages and the Hub chrome (header, sidebar, panels) must NOT be
   present in the captured output. */
const BYPASS_SUFFIXES = ["/print"];

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
  const desktopPad = expanded ? SIDEBAR_EXPANDED_W : SIDEBAR_COLLAPSED_W;
  /* When a Super Admin is "viewing as", a fixed banner sits below the header
     (top-14). Without extra top padding it overlaps and hides the first rows
     of page content (e.g. the picker's employee options). Push content down by
     the banner height while it's shown. */
  const { data: bootstrap } = useMeBootstrap();
  const viewingAs = !!bootstrap?.viewingAs;

  return (
    <QAInspectorProvider>
      <MainHeader />
      {/* Persistent banner shown when a Super Admin is "viewing as"
          another user. Sits below MainHeader (fixed, top-14) and is
          dismissed by clicking "Exit view-as" inside it. Returns null
          when no view-as is active. */}
      <ViewAsBanner />
      <Sidebar />
      {/* pt-14 = header height (+ banner height when viewing-as). Desktop: offset by sidebar width. */}
      <div
        className={`${viewingAs ? "pt-[5.75rem]" : "pt-14"} flex-1 flex flex-col min-h-0 h-[calc(100vh-0px)] overflow-hidden transition-all duration-300 ease-in-out`}
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
        <div className="shell-content-offset flex-1 flex flex-col min-h-0 overflow-auto transition-all duration-300 ease-in-out">
          {children}
        </div>
      </div>
      <FloatingPanel />
      {/* Global QA issue reporter (floating button + modal). */}
      <ReportIssueButton />
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
