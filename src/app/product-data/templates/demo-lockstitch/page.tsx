"use client";

/* ---------------------------------------------------------------------------
   /product-data/templates/demo-lockstitch

   Phase 1 demo of the Product Template Engine.

   Behaviour:
     · No ?productId — render the Lockstitch template as a structural
       preview (state-only, "Preview JSON" button).
     · ?productId=<uuid> — resolve that product's `template_id` via
       /api/products/[id]/template-meta and render whichever template
       it's bound to. Saves persist to product_field_values. If the
       product has no template assigned yet, we fall back to Lockstitch
       and surface a hint banner explaining it.
   --------------------------------------------------------------------------- */

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import TemplateForm from "@/components/product-templates/TemplateForm";

const FALLBACK_SLUG = "lockstitch-sewing-machine";

function DemoLockstitchInner() {
  const params = useSearchParams();
  const productId = params.get("productId") ?? undefined;
  const modelId = params.get("modelId") ?? undefined;

  const [resolvedSlug, setResolvedSlug] = useState<string | null>(null);
  const [resolveStatus, setResolveStatus] = useState<
    "idle" | "loading" | "fallback" | "resolved" | "error"
  >("idle");
  const [resolveError, setResolveError] = useState<string | null>(null);

  /* Resolve template from product when bound. The demo no longer
     hardcodes Lockstitch when a productId is supplied — it follows
     the product's template_id. */
  useEffect(() => {
    if (!productId) {
      setResolvedSlug(FALLBACK_SLUG);
      setResolveStatus("idle");
      return;
    }
    let cancelled = false;
    setResolveStatus("loading");
    setResolveError(null);
    (async () => {
      try {
        const res = await fetch(
          `/api/products/${encodeURIComponent(productId)}/template-meta`,
          { credentials: "include" },
        );
        if (!res.ok) {
          const j = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(j.error ?? `HTTP ${res.status}`);
        }
        const j = (await res.json()) as { templateSlug: string | null };
        if (cancelled) return;
        if (j.templateSlug) {
          setResolvedSlug(j.templateSlug);
          setResolveStatus("resolved");
        } else {
          setResolvedSlug(FALLBACK_SLUG);
          setResolveStatus("fallback");
        }
      } catch (e) {
        if (cancelled) return;
        setResolvedSlug(FALLBACK_SLUG);
        setResolveStatus("error");
        setResolveError(e instanceof Error ? e.message : "Failed to resolve template");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [productId]);

  return (
    <div className="mx-auto w-full max-w-5xl px-4 sm:px-6 py-6 sm:py-8 space-y-6">
      {/* Phase banner — make it explicit this is a foundation preview */}
      <div className="rounded-xl border border-black/[0.08] dark:border-white/[0.08] bg-black/[0.02] dark:bg-white/[0.03] px-4 py-3">
        <div className="text-[11px] font-bold uppercase tracking-wider text-black/45 dark:text-white/40">
          Product Template Engine · Phase 1
        </div>
        <div className="mt-0.5 text-[12.5px] text-black/65 dark:text-white/65">
          {!productId &&
            "Preview-only demo. Append ?productId=<uuid> to bind to a real product."}
          {productId && resolveStatus === "loading" && "Resolving template for product…"}
          {productId && resolveStatus === "resolved" && (
            <>
              Bound to product. Template resolved from <code>products.template_id</code>.
            </>
          )}
          {productId && resolveStatus === "fallback" && (
            <>
              Product has no <code>template_id</code> yet — falling back to Lockstitch
              for the demo. Saves will still persist.
            </>
          )}
          {productId && resolveStatus === "error" && (
            <>
              Could not resolve template ({resolveError}). Falling back to Lockstitch.
            </>
          )}
        </div>
      </div>

      {resolvedSlug && (
        <TemplateForm
          templateSlug={resolvedSlug}
          productId={productId}
          modelId={modelId}
          previewOnly={!productId}
        />
      )}
    </div>
  );
}

export default function DemoLockstitchPage() {
  return (
    <Suspense fallback={null}>
      <DemoLockstitchInner />
    </Suspense>
  );
}
