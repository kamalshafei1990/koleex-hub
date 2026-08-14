"use client";

/* ---------------------------------------------------------------------------
   useTopRampOwner — "this screen already draws its own top edge blur."

   Owner's rule, confirmed on Purchase 2026-08-15: a screen shows ONE blurred
   edge. An app that hosts its own long ramp (kx-bar-prog with --kx-ramp-top,
   reaching up behind the title and search rows) already covers the top 56px,
   so the main header pane must NOT add its flat blur(40px) on top. Two
   filtered bands in the same strip read as two edges — and the pane's, which
   stops dead at the header's bottom, is the one you actually see.

   WHY A LIVE DECLARATION AND NOT A ROUTE LIST. The first version keyed the
   pane's stand-down off appOwnsTopRamp(pathname) and broke /products the same
   day: Product Data's ramp rides its category jump-nav, which only renders
   when there is more than one category, and the catalog was empty. The route
   claimed a ramp, nothing drew one, the pane stood down on that claim, and
   the page ended up with no blur over the header at all. A route list says
   what an app usually does; only the component that mounts the layer knows
   whether it did.

   So: call this from the component that renders the ramp, passing whether it
   is actually rendering one right now. The attribute is set while that is
   true and removed on the way out.
   --------------------------------------------------------------------------- */

import { useEffect } from "react";

export function useTopRampOwner(active: boolean): void {
  useEffect(() => {
    if (!active) return;
    const root = document.documentElement;
    /* Counted, not a boolean flag. Product Data mounts up to three of these
       (list toolbar, category nav, profile/form bars) and they can overlap
       during a route transition — the outgoing screen's cleanup would
       otherwise delete the attribute the incoming one just set, and the pane
       would flash its flat frost back on mid-navigation. */
    const n = Number(root.dataset.kxToprampCount || "0") + 1;
    root.dataset.kxToprampCount = String(n);
    root.dataset.kxTopramp = "app";
    return () => {
      const left = Number(root.dataset.kxToprampCount || "1") - 1;
      if (left > 0) {
        root.dataset.kxToprampCount = String(left);
      } else {
        delete root.dataset.kxToprampCount;
        delete root.dataset.kxTopramp;
      }
    };
  }, [active]);
}
