"use client";

/* SW-4 (Phase 4): code-split the 303KB ProductForm off the four route bundles
   that render it (products/new, products/[id]/edit, product-data/new,
   product-data/[id]/edit). It's a large client-only editor — ssr:false is
   correct (nothing meaningful to SSR, no hydration mismatch) and the skeleton
   prevents a blank flash. Props are forwarded verbatim so every call site
   keeps its exact behaviour (edit id, deep links, route state). One wrapper =
   one shared chunk, imported lazily at all four sites. Fully reversible:
   repoint the four imports back to ProductForm. */
import dynamic from "next/dynamic";
import type { ComponentProps } from "react";
import AppLoadingSkeleton from "@/components/ui/AppLoadingSkeleton";
import type ProductForm from "./ProductForm";

const LazyProductForm = dynamic(() => import("./ProductForm"), {
  ssr: false,
  loading: () => <AppLoadingSkeleton label="Loading product editor…" />,
});

export default function ProductFormLazy(props: ComponentProps<typeof ProductForm>) {
  return <LazyProductForm {...props} />;
}
