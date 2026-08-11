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
    p.startsWith("/product-data")
  );
}
