/**
 * Product detail — /products/[id]   (id may be a slug OR a UUID)
 * ---------------------------------------------------------------------------
 * HYBRID route:
 *   • If the product has a RESOLVED schema → render the schema-driven
 *     <ProductPreview> (the Product Intelligence experience).
 *   • Otherwise → fall back to <LegacyProductView>, the original renderer,
 *     so the ~660 products that have no schema yet keep working unchanged.
 *
 * This is how the new experience reaches the route customers actually browse
 * without breaking non-schema products. As more machine-kind schemas land +
 * products get schema_specs, more products automatically upgrade to the new
 * view — no per-product or per-route work.
 */

import Link from "next/link";
import type { Metadata } from "next";

import { loadPublicSchemaProduct } from "@/lib/server/product-detail";
import { getSessionAccountId } from "@/lib/server/session";
import { ProductPreview } from "@/components/product-preview/ProductPreview";
import ArrowLeftIcon from "@/components/icons/ui/ArrowLeftIcon";
import LegacyProductView from "./LegacyProductView";

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
    <div className="min-h-screen bg-[var(--bg-primary)]">
      <header className="border-b border-[var(--border-subtle)]">
        <div className="mx-auto w-full max-w-6xl px-4 md:px-8 py-4">
          <Link
            href="/products"
            className="inline-flex items-center gap-2 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
          >
            <ArrowLeftIcon className="h-4 w-4" />
            <span>All products</span>
          </Link>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl px-4 md:px-8 py-6 md:py-10">
        <ProductPreview {...loaded.preview} />
      </main>
    </div>
  );
}
