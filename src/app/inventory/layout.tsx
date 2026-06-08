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
import { InventoryShortcutsLegend } from "@/components/inventory/InventoryUx";
import { useTranslation } from "@/lib/i18n";
import { inventoryT } from "@/lib/translations/inventory";

/* Each route maps to a translation key base; title/subtitle resolve via t()
   so the page header follows the selected system language (en/zh/ar). */
const ROUTE_KEY: Record<string, string> = {
  "/inventory":            "ops",
  "/inventory/items":      "items",
  "/inventory/movements":  "movements",
  "/inventory/transfers":  "transfers",
  "/inventory/returns":    "returns",
  "/inventory/balances":   "balances",
  "/inventory/search":     "search",
  "/inventory/serials":    "serials",
  "/inventory/batches":    "batches",
  "/inventory/warehouses": "warehouses",
};

function keyFor(pathname: string): string {
  if (ROUTE_KEY[pathname]) return ROUTE_KEY[pathname];
  for (const prefix of Object.keys(ROUTE_KEY)) {
    if (prefix !== "/inventory" && pathname.startsWith(prefix + "/")) return ROUTE_KEY[prefix];
  }
  return ROUTE_KEY["/inventory"];
}

export default function InventoryLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? "/inventory";
  const { t } = useTranslation(inventoryT);
  const k = keyFor(pathname);
  const meta = { title: t(`inv.page.${k}.title`), subtitle: t(`inv.page.${k}.subtitle`) };
  return (
    <div className="min-h-screen bg-[var(--bg-primary)] pb-16 text-[var(--text-primary)] md:pb-6">
      <div className="mx-auto max-w-[1500px] space-y-5 px-4 py-6 sm:px-6">
        <InventoryHeader title={meta.title} subtitle={meta.subtitle} />
        {children}
      </div>
      {/* GEN-8 — discoverable keyboard-shortcuts legend (desktop). */}
      <InventoryShortcutsLegend />
    </div>
  );
}
