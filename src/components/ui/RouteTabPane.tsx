"use client";

/* ---------------------------------------------------------------------------
   RouteTabPane — give a ROUTE-BASED tab bar the exact motion Product Data's
   tabs have.

   WHY NOT VIEW TRANSITIONS. Product Data's tabs are component state: the pane
   is keyed by the tab, React remounts it, and the new pane plays
   kx-tab-in-fwd/back on mount. Simple, and it always looks right because the
   animation starts on the element that is actually appearing.

   Apps like Inventory, Purchases, Finance and Database build their tab bar out
   of real sub-routes, so a tab click is a navigation. Routing it through
   `document.startViewTransition` looked equivalent on paper and was not: the
   browser captures the "new" snapshot as soon as the navigation callback
   returns, which is BEFORE the App Router has rendered the new page, so the
   thing that slides in is frequently the old screen or an empty one — motion
   that measures perfectly and reads as nothing. Owner, twice: "there is no
   motion when I switch from tab to another", "nothing changed at all".

   So route tabs now use the SAME mechanism as Product Data. This wrapper is
   keyed by pathname, so React unmounts the old page and mounts the new one,
   and the new one carries the directional class — the animation therefore
   starts on the element that is genuinely appearing, after it has rendered.

   Direction comes from the tab's INDEX inside its own strip (recorded at
   click time by ViewTransitions), never from path depth: depth is what once
   made a single tab bar play three different motions.
   --------------------------------------------------------------------------- */

import { usePathname } from "next/navigation";
import { readRouteTabDir } from "@/lib/route-tab-motion";

export default function RouteTabPane({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? "";
  /* No state, and that is the whole fix. Holding the direction in state meant
     claiming it during render, and a render that consumes something is not
     pure — React re-runs render functions (Strict Mode, render-phase updates)
     and the repeat run found an empty slot, so the motion appeared on about a
     third of clicks. readRouteTabDir is keyed by pathname and changes nothing,
     so every run of this component agrees, and the class is simply part of
     what this route renders.

     The key is the pathname: React unmounts the old page and mounts the new
     one, so the animation starts on the element that is genuinely appearing,
     after it has rendered — exactly what Product Data's keyed tab pane does.
     A later re-render (state changing inside the page) keeps both the key and
     the class, so nothing replays. */
  const dir = readRouteTabDir(pathname);
  return (
    <div key={pathname} className={dir}>
      {children}
    </div>
  );
}
