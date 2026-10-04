"use client";

/* Internal product record. NOT the customer-facing product page.

   This route used to render the legacy product view (retired 19/09/2026) — the same component the
   Products app shows to customers, with internal blocks bolted on. That is
   the wrong shape for Product Data: a showroom hides what is empty, and an
   operator opens a product precisely to find what is missing. The two apps
   answer different questions, so they no longer share a page.

   The customer-facing page still lives at /products/[slug], and the header
   here links to it. */

import { Suspense } from "react";
import dynamic from "next/dynamic";
import AppLoadingSkeleton from "@/components/ui/AppLoadingSkeleton";
import SpinnerIcon from "@/components/icons/ui/SpinnerIcon";
import PermissionGate from "@/components/layout/PermissionGate";

/* Wave A: code-split the 2627-line product profile off the route bundle
   (SW-4, same as /crm + /discuss). */
const ProductProfile = dynamic(() => import("@/components/admin/ProductProfile"), {
  ssr: false,
  loading: () => <AppLoadingSkeleton label="Loading product…" />,
});

export default function ProductDataDetailPage() {
  return (
    <PermissionGate module="Product Data">
      <Suspense
        fallback={
          <div className="flex-1 min-h-0 flex items-center justify-center bg-[var(--bg-primary)]">
            <SpinnerIcon className="h-5 w-5 text-[var(--text-dim)]" />
          </div>
        }
      >
        <ProductProfile />
      </Suspense>
    </PermissionGate>
  );
}
