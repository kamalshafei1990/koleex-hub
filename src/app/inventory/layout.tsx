"use client";

/* ---------------------------------------------------------------------------
   /inventory/* layout — same pattern as /purchase/layout.tsx.

   Renders the page wrapper + InventoryHeader (sticky pill menu) ONCE for
   every route in the segment. React preserves the layout's DOM nodes
   across sibling-route navigations, so:

     · The pill menu doesn't unmount and re-mount when the user clicks a
       tab — no more "menu changes size and position" jump.
     · The sliding indicator inside SlidingPillNav animates `translateX`
       to the new active tab via its CSS transition (~350ms) instead of
       instantly snapping at the new position.
     · The bar's horizontal scroll position is preserved across
       navigations.

   Title + subtitle are picked from a pathname-keyed config map. Per-page
   action buttons used to live in the header; they now live at the top of
   the page body so they stay close to the content they affect.

   Detail routes (`/inventory/transfers/[id]`, `/inventory/returns/[id]`)
   fall back to their group's title. Detail pages can render a
   doc-number sub-hero inside their own body when they want to surface
   the specific record.
   --------------------------------------------------------------------------- */

import { usePathname } from "next/navigation";
import InventoryHeader from "@/components/inventory/InventoryHeader";

interface RouteMeta { title: string; subtitle?: string }

const ROUTE_META: Record<string, RouteMeta> = {
  "/inventory":            { title: "Inventory Operations", subtitle: "What needs doing today — receive, ship, transfer, adjust." },
  "/inventory/items":      { title: "Items",                subtitle: "Every stocked SKU — quantities on hand, status, lifecycle." },
  "/inventory/movements":  { title: "Movements",            subtitle: "Every in/out event posted against your stock." },
  "/inventory/transfers":  { title: "Transfers",            subtitle: "Move stock between warehouses with a single document." },
  "/inventory/returns":    { title: "Returns",              subtitle: "Customer and supplier returns — reverses stock, issues credit." },
  "/inventory/balances":   { title: "Stock Balances",       subtitle: "Derived truth — never edited directly. One row per item × location." },
  "/inventory/search":     { title: "Search",               subtitle: "Find any item, serial, batch, transfer, return or movement across all warehouses." },
  "/inventory/serials":    { title: "Serials",              subtitle: "Per-unit identity & lifecycle." },
  "/inventory/batches":    { title: "Batches",              subtitle: "Lots, expiry, FEFO picking." },
  "/inventory/warehouses": { title: "Locations",            subtitle: "Warehouses, ports, forwarders, customer sites — anywhere stock can sit." },
};

function metaFor(pathname: string): RouteMeta {
  if (ROUTE_META[pathname]) return ROUTE_META[pathname];
  // Detail routes fall back to their list page's meta.
  for (const prefix of Object.keys(ROUTE_META)) {
    if (prefix !== "/inventory" && pathname.startsWith(prefix + "/")) return ROUTE_META[prefix];
  }
  return ROUTE_META["/inventory"];
}

export default function InventoryLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? "/inventory";
  const meta = metaFor(pathname);
  return (
    <div className="min-h-screen bg-[var(--bg-primary)] pb-16 text-[var(--text-primary)] md:pb-6">
      <div className="mx-auto max-w-[1500px] space-y-5 px-4 py-6 sm:px-6">
        <InventoryHeader title={meta.title} subtitle={meta.subtitle} />
        {children}
      </div>
    </div>
  );
}
