"use client";

/* ---------------------------------------------------------------------------
   /product-data/preview/[productSlug]

   Phase 2 validator: visual READ-MODE view of a product driven by its
   template. Reuses the same data the edit form (TemplateForm) writes —
   different surface, same source.

   This route doesn't replace /products/[id] (the existing catalog page)
   — it's a side-by-side preview so we can validate visually that the
   structured template data renders cleanly.
   --------------------------------------------------------------------------- */

import { use } from "react";
import Link from "next/link";
import TemplateView from "@/components/product-templates/TemplateView";

export default function ProductPreviewPage({
  params,
}: {
  params: Promise<{ productSlug: string }>;
}) {
  const { productSlug } = use(params);

  return (
    <div className="mx-auto w-full max-w-5xl px-4 sm:px-6 py-6 sm:py-10 space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-black/45 dark:text-white/40">
          Product Preview · Read mode
        </div>
        <Link
          href={`/product-data/templates/demo-lockstitch?productId=${productSlug === "l8-lockstitch" ? "c243be45-f5f0-4bd5-99e8-63be191b4f4d" : ""}`}
          className="text-[11.5px] font-semibold text-black/70 dark:text-white/70 hover:text-black dark:hover:text-white underline-offset-2 hover:underline"
        >
          Edit values →
        </Link>
      </div>
      <TemplateView productSlug={productSlug} />
    </div>
  );
}
