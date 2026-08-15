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
    p.startsWith("/purchase") ||
    /* CRM and Settings, 2026-08-15. Owner: make every app's top edge match
       Purchase. Both render the canonical PageHeader, so listing them here is
       the entire change — the band draws the ramp, the hero lifts above it and
       the pane stands down, with no per-app code.

       Sticky audit, required by the note at the top of this file:
       · /crm has ZERO stickies of its own.
       · /settings has exactly one, and it is `sticky bottom-0` (the profile
         tab's save bar). Bottom-anchored, so the top geometry cannot reach it.
       Both therefore inherit the same clean case as Purchase.

       NOT here on purpose: /suppliers. It ships two `sticky top-0` bars of its
       own (SupplierDetail's toolbar, KoleexMainSuppliers' group header), which
       under this geometry would pin at the same y as PageHeader's band and
       collide with it. That one needs its own measured pass, not a list
       entry. */
    p.startsWith("/crm") ||
    p.startsWith("/settings") ||
    /* Sales, 2026-08-16.

       Sticky audit, required by the note at the top of this file: /sales has
       ZERO stickies of its own — grepped across all three route components and
       every module, and the only hit in the whole app is inside a comment. Its
       one sticky is PageHeader's tab band at top-0, the same clean case as
       Purchase and /crm.

       ONE ASYMMETRY WORTH KNOWING, because it is not visible from this list.
       The segment has two page shapes:
         · /sales/orders and /sales/orders/[id] FLOW — they scroll in the Hub
           scroller, so content genuinely passes under the header and the pane
           has something to frost.
         · /sales itself is a tab app: SalesApp is `h-full overflow-hidden`
           with its OWN internal scroller, so the shell scroller never moves
           and nothing travels under the header.
       Listing the segment is still right — it is what makes the top edge read
       as glass rather than a solid bar, which is the whole point of H0 rule 1
       — but on /sales the effect is the resting frost, not motion under it.

       AND THAT ASYMMETRY IS ALSO WHY /sales IS NOT IN appOwnsTopRamp BELOW.
       The entry there exists because on Purchase/Inventory/CRM the sticky tab
       strip pins at 56 and would sit entirely inside the 104px ramp, going
       soft. Sales renders the same PageHeader with the same tabs, so it looks
       like the same case — it is not, and measuring is what settled it. The
       band lives in SalesApp's non-scrolling `shrink-0` top section, above the
       internal scroller, so it never pins: measured on /sales, ramp bottom
       104, strip top 210 — **106px of clearance**, and the strip cannot move
       toward it because nothing scrolls underneath. Handing this segment the
       flat 56px frost would buy a ramp that never gets drawn on the order
       pages, which is the exact trade Settings is excluded for. */
    p.startsWith("/sales") ||
    /* Expenses, 2026-08-16. Sticky audit: ZERO stickies of its own — grepped
       across all three of its components, no hits outside comments.

       Like Settings, it renders the canonical PageHeader with `showTabs={false}`
       and puts its navigation in AppHomeMenu instead, so there is no sticky tab
       band. That is precisely why it belongs HERE and not in appOwnsTopRamp
       below: with no band there is no ramp host, and listing it there would
       trade the pane's frost for a ramp that never gets drawn. */
    p.startsWith("/expenses") ||
    /* Notes, Projects, Planning — 2026-08-16, converted together.

       Sticky audit: all three have ZERO stickies. The only `sticky` hit across
       their components is inside a comment in NotesList.

       All three render PageHeader with `showTabs={false}` and put their
       navigation in AppHomeMenu, so like Settings and Expenses there is no
       sticky tab band — which is why they belong here and NOT in
       appOwnsTopRamp: no band means no ramp host, and listing them there
       would trade the pane's frost for a ramp nothing draws.

       All three are also internal-scroller apps (`h-full overflow-hidden`),
       so as on /sales the pane frosts at rest rather than having content
       travel under it. Listing them is still what stops the top edge reading
       as a solid bar over a glass page. */
    p.startsWith("/notes") ||
    p.startsWith("/projects") ||
    p.startsWith("/planning") ||
    /* Finance, 2026-08-16 — 29 routes, one entry.

       Sticky audit: ZERO stickies across all 36 finance components; every
       `sticky` hit in the app is inside a comment.

       Finance does NOT render the canonical PageHeader — FinanceUi exports its
       own, which is a plain title/subtitle/action block with no band and no
       tab strip. So there is no `.kx-ph-band` to host a ramp, which puts it in
       the Settings case: it belongs HERE, where the pane's own frost stops the
       top edge reading as a solid bar, and NOT in appOwnsTopRamp, which would
       hand it the flat 56px frost in exchange for a ramp nothing draws. */
    p.startsWith("/finance")
  );
  /* CONTACTS / SUPPLIERS / CUSTOMERS ARE STRUCTURALLY A DIFFERENT CASE, and
     the measurement is what settled it. I added all three, then took them out.

     One component (components/contacts/Contacts.tsx) serves the three routes,
     and it puts its list in its OWN scroll container. Measured on /suppliers:
     that container starts at y=207 while the header pane ends at 104. Nothing
     these screens render ever passes under the header — so the ramp would
     frost nothing, while permanently softening the one thing that IS in its
     band: the static app title at y=76. ProductForm's own comment states the
     rule I was breaking — "the ramp is for content PASSING under a bar, not
     for content parked there."

     THE EDGE BLUR IS NOT UNIVERSAL. It belongs to apps whose content scrolls
     beneath the header. An app with an internal scroller keeps the flat frost,
     and that is correct rather than unfinished.

     A second thing this cost me: my sticky audit for /suppliers grepped the
     app's own folder and found nothing, so I nearly called it clean. Measuring
     the rendered route found 21 sticky alphabet headers — the element lives in
     contacts/, and a route can render components from anywhere. AUDIT STICKIES
     BY MEASURING THE ROUTE, NEVER BY GREPPING THE FOLDER. */
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
    || p.startsWith("/purchase")
    /* CRM: same PageHeader, same sticky tab band, same choice as Purchase. */
    || p.startsWith("/crm");
  /* SETTINGS IS DELIBERATELY ABSENT, and the measurement is why. It renders a
     PageHeader with NO tabs, so there is no band, no ramp host and nothing to
     own — `.kx-ph-band` and `.kx-ph-tabs` both measured absent, and its only
     sticky is a bottom-anchored save bar. Listing it here would hand it the
     flat 56px frost in exchange for a ramp that never gets drawn, which is the
     same trade that left /products with no blur at all. Left off, it takes the
     pane's own 104px progressive ramp — the Home case, which is the correct
     one for a screen with no sticky bar of its own. */
}
