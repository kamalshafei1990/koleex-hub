"use client";

import { Suspense } from "react";
import dynamic from "next/dynamic";
import AppLoadingSkeleton from "@/components/ui/AppLoadingSkeleton";
import SpinnerIcon from "@/components/icons/ui/SpinnerIcon";

/* Wave A: code-split the 4258-line product catalogue off the initial route
   bundle. Client-only list (fetches on mount) so ssr:false is correct — the
   skeleton avoids a blank flash while the chunk loads. Same pattern as
   /crm and /discuss (SW-4). */
const ProductList = dynamic(() => import("@/components/admin/ProductList"), {
  ssr: false,
  loading: () => <AppLoadingSkeleton label="Loading products…" />,
});

export default function ProductsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex-1 min-h-0 flex items-center justify-center bg-[var(--bg-primary)]">
          <SpinnerIcon className="h-5 w-5 text-[var(--text-dim)]" />
        </div>
      }
    >
      <ProductList />
    </Suspense>
  );
}
