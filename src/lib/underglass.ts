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
    p.startsWith("/inventory") ||
    /* Purchase, 2026-08-14. Converting the app's own surfaces and stopping
       there is exactly the failure this file warns about two comments up: the
       ground, the glass cards and the chrome were all done, and the screen
       still wore a solid black bar across its top because the header pane
       only frosts on routes listed HERE. Owner reported it as the missing
       edge blur.

       Sticky audit, required by the note at the top of this file: Purchase
       has ZERO stickies of its own — grepped, every hit in the app is a
       comment. Its only sticky is PageHeader's tab band at top-0, the same
       one Inventory declares safe, and for the same reason: a sticky inside
       the padded under-glass scroller already lands below the header. */
    p.startsWith("/purchase")
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
    || p.startsWith("/inventory")
    /* Purchase, like Inventory, and the deciding number is 104 vs 56.
       This entry is easy to misread as "the app draws its own long fade" —
       and on PageHeader apps nothing does: `.kx-ph-band` is a transparent
       sticky carrier and `.kx-ph-tabs` is a blur(16px) glass pill. But that
       is not what the entry has to protect against. The progressive pane is
       **104px** tall (header 56 + a 48px approach ramp), while PageHeader's
       sticky tab strip pins at exactly 56 and stands ~40px tall — so under
       the ramp the app's primary navigation sits ENTIRELY inside the blurred
       band and goes soft. Owner: "this should be in the top not under the
       blur edge."
       The flat frost stops dead at 56, so the strip clears it and stays
       crisp. That is the whole reason Inventory is here too. */
    || p.startsWith("/purchase");
}
