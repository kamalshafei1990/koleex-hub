"use client";

/* ---------------------------------------------------------------------------
   RootShell — client-side wrapper used by the root layout.

   · `/login` and `/auth/*` bypass authentication entirely.
   · Every other route is wrapped in AuthGate + MainHeader + Sidebar.
   · The sidebar provider gives shared state to both Sidebar and MainHeader.
   --------------------------------------------------------------------------- */

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import AuthGate from "@/components/admin/AuthGate";
import MainHeader from "./MainHeader";
import Sidebar from "./Sidebar";
import FloatingPanel from "./FloatingPanel";
import { useMeBootstrap } from "@/lib/me-bootstrap";
import {
  SidebarProvider,
  useSidebar,
  SIDEBAR_EXPANDED_W,
  SIDEBAR_COLLAPSED_W,
} from "./SidebarContext";

/* /change-password is in this list because:
   1. it MUST render standalone (no sidebar + header chrome while the
      user is blocked from the rest of the app), and
   2. if the gate below sent the user to /change-password, we'd loop
      forever trying to redirect them off it. */
const BYPASS_PREFIXES = ["/login", "/auth", "/change-password"];

function isBypassed(pathname: string | null): boolean {
  if (!pathname) return false;
  return BYPASS_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(p + "/"),
  );
}

/** Inner shell that consumes sidebar context for the padding offset. */
function ShellContent({ children }: { children: React.ReactNode }) {
  const { expanded } = useSidebar();
  const desktopPad = expanded ? SIDEBAR_EXPANDED_W : SIDEBAR_COLLAPSED_W;

  return (
    <>
      <MainHeader />
      <Sidebar />
      {/* pt-14 = header height. Desktop: offset by sidebar width. */}
      <div
        className="pt-14 flex-1 flex flex-col min-h-0 h-[calc(100vh-0px)] overflow-hidden transition-all duration-300 ease-in-out"
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
    </>
  );
}

/* Client-side gate that bounces the signed-in user to /change-password
   when their account has force_password_change=true. Runs inside the
   authenticated tree so we know the cookie is valid before firing a
   bootstrap fetch. Next.js middleware would be cleaner, but this app
   doesn't have one today; this matches the existing pattern of
   gating via AuthGate + client hooks. */
function ForcePasswordChangeGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { data } = useMeBootstrap();

  useEffect(() => {
    if (!data?.header) return;
    const mustChange = Boolean(
      (data.header as { force_password_change?: boolean }).force_password_change,
    );
    if (mustChange && pathname !== "/change-password") {
      router.replace("/change-password");
    }
  }, [data, pathname, router]);

  return <>{children}</>;
}

export default function RootShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  if (isBypassed(pathname)) {
    return <>{children}</>;
  }

  return (
    <AuthGate title="Koleex Hub" subtitle="Sign in to access the platform">
      <ForcePasswordChangeGate>
        <SidebarProvider>
          <ShellContent>{children}</ShellContent>
        </SidebarProvider>
      </ForcePasswordChangeGate>
    </AuthGate>
  );
}
