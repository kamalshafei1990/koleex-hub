"use client";

/* ---------------------------------------------------------------------------
   /product-data — internal admin catalog (full fields).

   Same underlying UI as /products, but:
     · Guarded by the "Product Data" module permission
     · Shows cost_price, supplier, internal notes, etc.
     · This is the working tool admins use to ADD / EDIT / REMOVE products.

   The PUBLIC /products page is a cleaned-up read view of the same rows,
   visible to customers without secrets.
   --------------------------------------------------------------------------- */

import { Suspense } from "react";
import dynamic from "next/dynamic";
import AppLoadingSkeleton from "@/components/ui/AppLoadingSkeleton";
import SpinnerIcon from "@/components/icons/ui/SpinnerIcon";
import PermissionGate from "@/components/layout/PermissionGate";

/* Wave A: code-split the product catalogue list off the route bundle (SW-4,
   same as /crm + /discuss). */
const ProductList = dynamic(() => import("@/components/admin/ProductList"), {
  ssr: false,
  loading: () => <AppLoadingSkeleton label="Loading product data…" />,
});

export default function ProductDataPage() {
  return (
    <PermissionGate module="Product Data">
      <Suspense
        fallback={
          <div className="flex-1 min-h-0 flex items-center justify-center bg-[var(--bg-primary)]">
            <SpinnerIcon className="h-5 w-5 text-[var(--text-dim)]" />
          </div>
        }
      >
        <ProductList />
      </Suspense>
    </PermissionGate>
  );
}
