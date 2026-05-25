"use client";

/* ---------------------------------------------------------------------------
   /purchase/* layout — renders the page wrapper + PurchaseHeader (sticky
   pill menu) ONCE for every route in the segment. React preserves these
   DOM nodes across sibling-route navigations, so:

     · The pill menu doesn't unmount and re-mount when the user clicks a
       tab — no more "menu changes size and position" jump.
     · The sliding indicator inside SlidingPillNav animates `translateX`
       to the new active tab via its CSS transition (~350ms) instead of
       instantly re-appearing at the new position.
     · Scroll position of the horizontal pill bar is preserved across
       navigations.

   Title + subtitle are picked from a config map keyed by pathname so the
   layout (which renders the header) knows what to display.

   Per-page action buttons (e.g. "New PO") are NOT in the header anymore.
   Pages render their own action row inside their content area — cleaner
   anyway, since actions are page-specific not chrome.
   --------------------------------------------------------------------------- */

import { usePathname } from "next/navigation";
import PurchaseHeader from "@/components/purchase/PurchaseHeader";

interface RouteMeta { title: string; subtitle?: string }

const ROUTE_META: Record<string, RouteMeta> = {
  "/purchase":                { title: "Purchase",         subtitle: "From requisition to payment — the full procure-to-pay loop." },
  "/purchase/requisitions":   { title: "Requisitions",     subtitle: "Internal purchase requests — the first step in procure-to-pay." },
  "/purchase/rfqs":           { title: "Requests for Quote", subtitle: "Ask suppliers to bid, then award to the best offer." },
  "/purchase/orders":         { title: "Purchase Orders",  subtitle: "Confirmed buy commitments. Receive against them as goods arrive." },
  "/purchase/receipts":       { title: "Goods Receipts",   subtitle: "Record what physically arrived. Each receipt posts a movement into inventory." },
  "/purchase/bills":          { title: "Vendor Bills",     subtitle: "Supplier invoices, 3-way matched against POs + receipts before posting to AP." },
  "/purchase/payments":       { title: "Payments",         subtitle: "Outgoing payments to suppliers. Group bills into a payment run, or pay one-off." },
  "/purchase/returns":        { title: "Vendor Returns",   subtitle: "Send goods back to a supplier. Produces a credit memo and reverses stock." },
  "/purchase/suppliers":      { title: "Suppliers",        subtitle: "Vendor master — scorecards, payment terms, lead times, contacts." },
  "/purchase/contracts":      { title: "Contracts",        subtitle: "Term agreements with suppliers — pricing, volumes, burn-down." },
  "/purchase/categories":     { title: "Spend Categories", subtitle: "Classify spend for analytics. Maps to GL expense accounts." },
  "/purchase/price-lists":    { title: "Price Lists",      subtitle: "Supplier catalog pricing. Drives PO line defaults and price-variance checks." },
  "/purchase/approvals":      { title: "Approval Rules",   subtitle: "Threshold-driven approval routing. Who needs to sign off on what spend." },
  "/purchase/reports":        { title: "Spend Analytics",  subtitle: "By supplier, category, period. Find savings, monitor variance, score vendors." },
};

const FALLBACK_META: RouteMeta = { title: "Purchase", subtitle: "Procurement workspace." };

export default function PurchaseLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? "/purchase";
  const meta = ROUTE_META[pathname] ?? FALLBACK_META;
  return (
    <div className="min-h-screen bg-[var(--bg-primary)] pb-16 text-[var(--text-primary)] md:pb-6">
      <div className="mx-auto max-w-[1500px] space-y-5 px-4 py-6 sm:px-6">
        <PurchaseHeader title={meta.title} subtitle={meta.subtitle} />
        {children}
      </div>
    </div>
  );
}
