/**
 * Product detail — /products/[id]   (id may be a slug OR a UUID)
 * ---------------------------------------------------------------------------
 * ONE renderer: the schema-driven <ProductPreview>, for every product. It
 * used to be a hybrid — products whose classification had no spec template
 * fell back to a second, legacy product page (2,439 lines). That renderer
 * retired on 19/09/2026: a product without a template now renders on the
 * same page as every other, with its typed legacy facts in place of a spec
 * sheet (product-detail.ts `legacyFacts`). Not found is a real 404.
 */

import Link from "next/link";
import ProductsIcon from "@/components/icons/ProductsIcon";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { preload } from "react-dom";
import { IMG } from "@/lib/cdn";

import { loadPublicSchemaProduct } from "@/lib/server/product-detail";
import { getServerAuth } from "@/lib/server/auth";
import { ProductPreview } from "@/components/product-preview/ProductPreview";
import ArrowLeftIcon from "@/components/icons/ui/ArrowLeftIcon";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const loaded = await loadPublicSchemaProduct(id);
  if (!loaded) return { title: "Product not found — KOLEEX" };
  return {
    /* The tab reads like the header: model first, then the name. */
    title: `${loaded.preview.primaryModel ? `${loaded.preview.primaryModel} · ` : ""}${loaded.productName} — KOLEEX`,
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
  /* Who is reading decides what the page may show (product-detail.ts,
     ProductAudience): staff see the Price section, a Hub account sees the
     Global FOB, nobody signed in sees the public shape and only ACTIVE
     products. Cached per request, so the metadata call above is free. */
  const auth = await getServerAuth();
  const audience = auth ? (auth.user_type === "internal" ? "internal" : "customer") : "public";
  const loaded = await loadPublicSchemaProduct(id, {
    allowUnpublished: Boolean(auth),
    audience,
  });

  /* Not found, or not public for this reader. The legacy renderer this
     route used to fall back to (2,439 lines, its own second product page)
     is retired: a product without a spec template renders on the same
     page as every other, with its typed facts in place of a spec sheet. */
  if (!loaded) notFound();

  /* The hero image is the page's LCP, and it used to be discovered only
     after the client bundle ran — fetched raw, at that. Announce the SAME
     sized URL the hero will render, so the browser starts it with the
     HTML. Poster when there is one (it is what paints first), else the
     main product shot. */
  const lcp = loaded.preview.posterUrl
    ? IMG.poster(loaded.preview.posterUrl)
    : loaded.preview.mainImageUrl
      ? IMG.hero(loaded.preview.mainImageUrl)
      : null;
  if (lcp) preload(lcp, { as: "image" });

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
            {/* The model is how the machine is known (owner, 19/09/2026): it
                leads the header; the descriptive name follows, lighter. */}
            <h1 className="min-w-0 flex items-baseline gap-2.5 truncate text-xl md:text-[22px] font-bold tracking-tight">
              {loaded.preview.primaryModel ? (
                <>
                  <span className="shrink-0 tabular-nums">{loaded.preview.primaryModel}</span>
                  <span className="truncate text-[15px] md:text-[16px] font-medium text-[var(--text-muted)]">{loaded.preview.productName}</span>
                </>
              ) : (
                <span className="truncate">{loaded.preview.productName}</span>
              )}
            </h1>
          </div>
        </div>
        <p className="text-[12px] text-[var(--text-dim)] mb-5 ml-0 md:ml-11 flex flex-wrap gap-x-4">
          <Link href="/products" className="hover:text-[var(--text-muted)] transition-colors">All products</Link>
          {/* The printed sheet (phase 5): three languages, no price. Staff
              only — a customer's brochure is handed over, not self-served. */}
          {audience === "internal" ? (
            <span className="flex gap-x-2">
              <span className="text-[var(--text-ghost)]">Print sheet:</span>
              {(["en", "zh", "ar"] as const).map((l) => (
                <a key={l} href={`/products/${loaded.slug}/print?lang=${l}`} target="_blank" rel="noopener" className="uppercase hover:text-[var(--text-muted)] transition-colors">{l}</a>
              ))}
            </span>
          ) : null}
        </p>
        <ProductPreview
          {...loaded.preview}
          productId={loaded.id}
          slug={loaded.slug}
          audience={loaded.audience}
          sections={loaded.sections}
        />
      </div>
    </div>
  );
}
