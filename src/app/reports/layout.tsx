"use client";

/* ---------------------------------------------------------------------------
   /reports/* layout — the Reports app's Aurora scope + the ground, once for
   the app (the /me shape: `min-h-full`, the page FLOWS and the Hub scroller
   scrolls it).

   THREE KINDS OF PAGE LIVE UNDER THIS URL, and only one of them is the app:
     /reports, /reports/[id]           the Reports app       → scope + ground
     /reports/operational, /statements the Finance number reports, which keep
                                       their own look untouched → bare
     /reports/[id]/print               paper                  → bare
   Excluded explicitly rather than split into a route group, the /travel
   precedent: a group moves the pages into a second tree, and the budgets
   guard reads routes by their folder — the app would ship unmeasured.
   --------------------------------------------------------------------------- */

import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import { useSkin } from "@/lib/appearance";

const WavyBackground = dynamic(() => import("@/components/ui/WavyBackground"), { ssr: false });

const BARE_PREFIXES = ["/reports/operational", "/reports/statements"];

export default function ReportsLayout({ children }: { children: React.ReactNode }) {
  const aurora = useSkin() === "aurora";
  const pathname = usePathname() ?? "";
  if (pathname.endsWith("/print") || BARE_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`))) return <>{children}</>;
  return (
    <div className={`${aurora ? "kx-app kx-ground-host " : ""}relative min-h-full bg-[var(--bg-primary)] text-[var(--text-primary)]`}>
      {aurora && (
        <div className="fixed inset-0 z-0 pointer-events-none" aria-hidden>
          <WavyBackground topLight />
        </div>
      )}
      {children}
    </div>
  );
}
