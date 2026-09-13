/**
 * Product detail — /products/[id]   (id may be a slug OR a UUID)
 * ---------------------------------------------------------------------------
 * HYBRID route:
 *   • If the product has a RESOLVED schema → render the schema-driven
 *     <ProductPreview> (the Product Intelligence experience).
 *   • Otherwise → fall back to <LegacyProductView>, the original renderer,
 *     so products that have no schema yet keep working unchanged. (That set
 *     has shrunk as schemas landed: 29 of 271 products as of 2026-08-29, which
 *     is why the legacy renderer is now a dynamic import — see below.)
 *
 * This is how the new experience reaches the route customers actually browse
 * without breaking non-schema products. As more machine-kind schemas land +
 * products get schema_specs, more products automatically upgrade to the new
 * view — no per-product or per-route work.
 */

import Link from "next/link";
import ProductsIcon from "@/components/icons/ProductsIcon";
import type { Metadata } from "next";

import { loadPublicSchemaProduct } from "@/lib/server/product-detail";
import { getSessionAccountId } from "@/lib/server/session";
import { ProductPreview } from "@/components/product-preview/ProductPreview";
import ArrowLeftIcon from "@/components/icons/ui/ArrowLeftIcon";
/* Lazy boundary — see LegacyProductViewLazy.tsx for why the dynamic()
   call cannot live in this Server Component. */
import LegacyProductView from "./LegacyProductViewLazy";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const loaded = await loadPublicSchemaProduct(id);
  if (!loaded) return {}; // legacy view sets its own document title client-side
  return {
    title: `${loaded.productName} — KOLEEX`,
    description: loaded.tagline ?? undefined,
  };
}

export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  // Logged-in hub users may preview draft/hidden schema products before they
  // are published; anonymous visitors still only see public ones.
  const accountId = await getSessionAccountId();
  const loaded = await loadPublicSchemaProduct(id, {
    allowUnpublished: Boolean(accountId),
  });

  // No resolved schema (or non-public / not found) → original renderer.
  if (!loaded) {
    return <LegacyProductView />;
  }

  // Schema-backed → the Product Intelligence experience.
  return (
    /* Hub page anatomy (KDS): same max width, padding and header block as
       every other app page — elected icon back button + icon tile + title.
       The old bordered "All products" bar was a one-off that matched
       nothing else in the system. */
    <div className="min-h-screen bg-[var(--bg-primary)]">
      <div className="max-w-[1500px] mx-auto px-4 md:px-6 lg:px-8 py-6 md:py-8">
        <div className="flex flex-wrap items-center gap-3 mb-1">
          <Link
            href="/products"
            aria-label="All products"
            className="h-8 w-8 flex items-center justify-center rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[var(--text-dim)] hover:text-[var(--text-primary)] transition-colors shrink-0"
          >
            <ArrowLeftIcon className="h-4 w-4 rtl:rotate-180" />
          </Link>
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            <div className="h-8 w-8 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] flex items-center justify-center text-[var(--text-dim)] shrink-0">
              <ProductsIcon size={16} />
            </div>
            <h1 className="text-xl md:text-[22px] font-bold tracking-tight truncate">
              {loaded.preview.productName}
            </h1>
          </div>
        </div>
        <p className="text-[12px] text-[var(--text-dim)] mb-5 ml-0 md:ml-11">
          <Link href="/products" className="hover:text-[var(--text-muted)] transition-colors">All products</Link>
        </p>
        <ProductPreview {...loaded.preview} />
      </div>
    </div>
  );
}
