"use client";

/* ---------------------------------------------------------------------------
   Product Data › Builder — the clean single-page add/edit product experience
   (replaces the old wizard, built incrementally). `?id=<uuid>` → edit mode.
   --------------------------------------------------------------------------- */

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import PermissionGate from "@/components/layout/PermissionGate";
import ProductBuilder from "@/components/admin/ProductBuilder";

function BuilderWithParams() {
  const id = useSearchParams().get("id") || undefined;
  return <ProductBuilder productId={id} />;
}

export default function ProductBuilderPage() {
  return (
    <PermissionGate module="Product Data">
      <Suspense fallback={<div className="h-72 grid place-items-center text-[13px] text-[var(--text-dim)]">Loading…</div>}>
        <BuilderWithParams />
      </Suspense>
    </PermissionGate>
  );
}
