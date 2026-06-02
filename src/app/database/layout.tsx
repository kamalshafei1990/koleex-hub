"use client";

/* ---------------------------------------------------------------------------
   /database/* layout — renders the page wrapper + DatabaseHeader (sticky pill
   menu) ONCE for every route in the segment, mirroring /inventory/layout.tsx.
   --------------------------------------------------------------------------- */

import { usePathname } from "next/navigation";
import DatabaseHeader from "@/components/database/DatabaseHeader";

interface RouteMeta { title: string; subtitle?: string }

const ROUTE_META: Record<string, RouteMeta> = {
  "/database":                { title: "Database",       subtitle: "Centralized data systems for the KOLEEX ecosystem." },
  "/database/visual-library": { title: "Visual Library", subtitle: "One approved source of truth for every icon, image and visual asset." },
  "/database/collections":    { title: "Collections",    subtitle: "Curated visual systems & icon packs — the KOLEEX design infrastructure." },
  "/database/review":         { title: "Review Board",   subtitle: "Operational approval workflow — review, score and clear assets for production." },
};

function metaFor(pathname: string): RouteMeta {
  if (ROUTE_META[pathname]) return ROUTE_META[pathname];
  for (const prefix of Object.keys(ROUTE_META)) {
    if (prefix !== "/database" && pathname.startsWith(prefix + "/")) return ROUTE_META[prefix];
  }
  return ROUTE_META["/database"];
}

export default function DatabaseLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? "/database";
  const meta = metaFor(pathname);
  return (
    <div className="min-h-screen bg-[var(--bg-primary)] pb-16 text-[var(--text-primary)] md:pb-6">
      <div className="mx-auto max-w-[1500px] space-y-5 px-4 py-6 sm:px-6">
        <DatabaseHeader title={meta.title} subtitle={meta.subtitle} />
        {children}
      </div>
    </div>
  );
}
