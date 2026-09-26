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
import RouteTabPane from "@/components/ui/RouteTabPane";
import dynamic from "next/dynamic";
import InventoryHeader from "@/components/inventory/InventoryHeader";
import { InventoryShortcutsLegend } from "@/components/inventory/InventoryUx";
import { useTranslation } from "@/lib/i18n";
import { inventoryT } from "@/lib/translations/inventory";
import { useSkin } from "@/lib/appearance";

/* The Aurora ground. ssr:false and mounted only under Aurora — a canvas is
   the one thing the skin switch cannot do in CSS, so Core renders zero
   canvases (canon B). */
const WavyBackground = dynamic(() => import("@/components/ui/WavyBackground"), { ssr: false });

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
  const aurora = useSkin() === "aurora";
  const k = keyFor(pathname);
  const meta = { title: t(`inv.page.${k}.title`), subtitle: t(`inv.page.${k}.subtitle`) };
  return (
    /* AURORA SCOPE — one class, the whole var-remap step of the Scale Pattern.
       It sits on the SEGMENT LAYOUT rather than on each page, so all fourteen
       inventory routes inherit the remap, the recessed-well form fields and
       the pane rules from a single place, and any route added later is
       converted the day it is created.

       kx-ground-host lifts this layout's own children above the fixed z-0
       canvas (positioned children excluded — that rule is what threw the
       sidebar's collapse button off-screen when it was written without the
       :not()s). Core keeps the solid --bg-primary it always had. */
    /* min-h-full — see the note in /purchase/layout.tsx: a 100vh floor inside
       the Hub scroller is one header-height taller than the visible area. */
    <div className={`${aurora ? "kx-app kx-ground-host " : ""}relative min-h-full bg-[var(--bg-primary)] pb-16 text-[var(--text-primary)] md:pb-6`}>
      {aurora && (
        <div className="fixed inset-0 z-0 pointer-events-none" aria-hidden>
          <WavyBackground topLight />
        </div>
      )}
      <div className="relative z-[1] mx-auto max-w-[1500px] space-y-5 px-4 py-6 sm:px-6">
        <InventoryHeader title={meta.title} subtitle={meta.subtitle} />
        <RouteTabPane>{children}</RouteTabPane>
      </div>
      {/* GEN-8 — discoverable keyboard-shortcuts legend (desktop). */}
      <InventoryShortcutsLegend />
    </div>
  );
}
