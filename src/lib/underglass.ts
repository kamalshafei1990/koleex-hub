/* Which routes run the UNDER-GLASS geometry: the scroller extends up
   behind the main header, content genuinely slides beneath the glass, and
   the header pane wears the progressive edge-blur ramp. One list, used by
   BOTH RootShell (shell/scroller geometry) and MainHeader (pane variant) —
   they must never disagree.

   Adding an app here is the canon's "underglass migration" step and MUST
   come with its sticky-toolbar audit: every sticky inside the app has to
   pin to var(--kx-header-h) (+ its own stacking offsets) instead of top-0,
   because under this geometry the scroller's top edge IS the viewport top. */
export function isUnderglassRoute(pathname: string | null): boolean {
  const p = pathname || "/";
  return (
    p === "/" ||
    p === "/products" ||
    p.startsWith("/products/") ||
    p.startsWith("/product-data") ||
    /* Inventory, 2026-08-12. THIS is what makes the main header glass on an
       app screen — the pane only frosts on under-glass routes, so converting
       an app's own surfaces and stopping there leaves a solid black bar at
       the top of a glass page. Sticky audit done: the app's one sticky
       (PageHeader's tab band) stays at top-0, because a sticky inside the
       padded under-glass scroller already lands below the header. */
    p.startsWith("/inventory")
  );
}

/* Routes where the APP owns the top edge-blur, so the header pane must NOT
   add a second one.
   ONE RAMP PER SCREEN is an owner rule: he counted three stacked on Product
   Data (header pane 0→104, toolbar 56→162, category nav 114→318) and called
   it wrong — "you only can use one but more longer". Where a screen has its
   own sticky bar stack, that stack runs a single tall ramp (the lowest bar
   carries it and extends upward over the ones above via --kx-ramp-top), and
   the header keeps only its own flat frost. Home, which has no sticky bars,
   still gets the pane ramp. */
export function appOwnsTopRamp(pathname: string | null): boolean {
  const p = pathname || "/";
  /* Inventory has a sticky tab band of its own, so the header keeps its flat
     frost and the screen shows ONE blurred edge, not two stacked. */
  return p === "/products" || p.startsWith("/products/") || p.startsWith("/product-data")
    || p.startsWith("/inventory");
}
