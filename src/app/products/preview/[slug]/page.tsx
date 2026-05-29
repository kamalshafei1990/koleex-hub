/**
 * Public product page — /products/preview/[slug]
 * ---------------------------------------------------------------------------
 * Thin server route over the shared loader. Renders the schema-driven
 * <ProductPreview>; 404s when the product is missing / non-public / has no
 * resolved schema. All fetch + surface-filtering lives in
 * src/lib/server/product-detail.ts (shared with /products/[id]).
 */

import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { loadPublicSchemaProduct } from "@/lib/server/product-detail";
import { ProductPreview } from "@/components/product-preview/ProductPreview";
import ArrowLeftIcon from "@/components/icons/ui/ArrowLeftIcon";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const loaded = await loadPublicSchemaProduct(slug);
  if (!loaded) return { title: "Product not found — KOLEEX" };
  return {
    title: `${loaded.productName} — KOLEEX`,
    description: loaded.tagline ?? undefined,
  };
}

export default async function PublicProductPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const loaded = await loadPublicSchemaProduct(slug);
  if (!loaded) notFound();

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
