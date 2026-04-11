"use client";

/* ---------------------------------------------------------------------------
   /discuss — Koleex team chat + customer conversations.

   Thin wrapper around <DiscussApp /> so we keep the actual UI out of the
   Next.js route file. Same pattern as /inbox (which inlines the UI)
   except we split it into a component because DiscussApp is genuinely
   reusable — for example, we could embed a trimmed version in a
   customer-facing product page later without dragging the route along.

   Why the `fixed inset-x-0 top-14 bottom-0` wrapper:
     The body in src/app/layout.tsx is `min-h-full flex flex-col` so that
     ordinary pages (forms, dashboards) can scroll naturally. That works
     against Discuss, where we want a *locked* viewport with a scrollable
     message list and a pinned composer at the bottom — without this
     wrapper the message list grows the body taller than the viewport
     and the composer scrolls out of view. Pinning the route to the area
     below the 56px MainHeader gives DiscussApp's internal flex chain a
     fixed box to live in, so `flex-1 min-h-0 overflow-y-auto` on the
     message list and `shrink-0` on the composer behave as intended.
   --------------------------------------------------------------------------- */

import { Suspense } from "react";
import { Loader2 } from "lucide-react";
import DiscussApp from "@/components/discuss/DiscussApp";

export default function DiscussPage() {
  return (
    <div className="fixed inset-x-0 top-14 bottom-0 flex flex-col">
      <Suspense
        fallback={
          <div className="flex-1 min-h-0 flex items-center justify-center bg-[var(--bg-primary)]">
            <Loader2 className="h-5 w-5 animate-spin text-[var(--text-dim)]" />
          </div>
        }
      >
        <DiscussApp />
      </Suspense>
    </div>
  );
}
