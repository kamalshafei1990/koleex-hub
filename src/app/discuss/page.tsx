"use client";

/* ---------------------------------------------------------------------------
   /discuss — Koleex team chat + customer conversations.

   Thin wrapper around <DiscussApp /> so we keep the actual UI out of the
   Next.js route file. Same pattern as /inbox (which inlines the UI)
   except we split it into a component because DiscussApp is genuinely
   reusable — for example, we could embed a trimmed version in a
   customer-facing product page later without dragging the route along.
   --------------------------------------------------------------------------- */

import { Suspense } from "react";
import SpinnerIcon from "@/components/icons/ui/SpinnerIcon";
import DiscussApp from "@/components/discuss/DiscussApp";

export default function DiscussPage() {
  return (
    <Suspense
      fallback={
        <div className="flex-1 min-h-0 flex items-center justify-center bg-[var(--bg-primary)]">
          <SpinnerIcon className="h-5 w-5 animate-spin text-[var(--text-dim)]" />
        </div>
      }
    >
      <DiscussApp />
    </Suspense>
  );
}
