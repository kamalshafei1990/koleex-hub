"use client";

/* ---------------------------------------------------------------------------
   Lazy boundary for the legacy product renderer.

   WHY THIS FILE EXISTS
   --------------------
   /products/[id] is hybrid: schema-backed products render <ProductPreview>,
   the rest fall back to <LegacyProductView>. Measured on a production build
   (2026-08-29), the legacy renderer's two chunks — 55KB + 166KB raw, ~55KB
   over the wire — were emitted as <script async> on EVERY product page, even
   the 242-of-271 that never render it.

   Calling next/dynamic from the page did NOT fix that: the page is a Server
   Component, so LegacyProductView stayed a client reference of the route, and
   Next emits script tags for every client reference in the route manifest
   whether or not the branch renders.

   Moving the dynamic() call inside a CLIENT component makes it a real runtime
   code-split point: the route only references THIS tiny wrapper, and the heavy
   chunk is fetched when the fallback actually renders.

   No ssr:false — those products must stay server-rendered and crawlable.
   --------------------------------------------------------------------------- */

import dynamic from "next/dynamic";

const LegacyProductView = dynamic(() => import("./LegacyProductView"));

export default function LegacyProductViewLazy() {
  return <LegacyProductView />;
}
