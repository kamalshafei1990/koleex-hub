"use client";

/* ---------------------------------------------------------------------------
   /product-data/templates/demo-lockstitch

   Phase 1 demo. Renders the Lockstitch template engine end-to-end with
   state-only persistence so reviewers can poke every field type without
   touching real product data.

   Bind it to a real product by appending ?productId=<uuid> to the URL —
   the form will hydrate from product_field_values and saves will
   round-trip to the DB.
   --------------------------------------------------------------------------- */

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import TemplateForm from "@/components/product-templates/TemplateForm";

function DemoLockstitchInner() {
  const params = useSearchParams();
  const productId = params.get("productId") ?? undefined;
  const modelId = params.get("modelId") ?? undefined;

  return (
    <div className="mx-auto w-full max-w-5xl px-4 sm:px-6 py-6 sm:py-8 space-y-6">
      {/* Phase banner — make it explicit this is a foundation preview */}
      <div className="rounded-xl border border-black/[0.08] dark:border-white/[0.08] bg-black/[0.02] dark:bg-white/[0.03] px-4 py-3">
        <div className="text-[11px] font-bold uppercase tracking-wider text-black/45 dark:text-white/40">
          Product Template Engine · Phase 1
        </div>
        <div className="mt-0.5 text-[12.5px] text-black/65 dark:text-white/65">
          Lockstitch demo. {productId
            ? "Bound to a real product — Save persists."
            : "Preview only — append ?productId=<uuid> to bind to a real product."}
        </div>
      </div>

      <TemplateForm
        templateSlug="lockstitch-sewing-machine"
        productId={productId}
        modelId={modelId}
        previewOnly={!productId}
      />
    </div>
  );
}

export default function DemoLockstitchPage() {
  /* useSearchParams must run inside a Suspense boundary at this Next.js
     version when rendered from a client page. */
  return (
    <Suspense fallback={null}>
      <DemoLockstitchInner />
    </Suspense>
  );
}
