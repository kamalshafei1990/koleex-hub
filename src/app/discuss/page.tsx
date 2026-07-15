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
import dynamic from "next/dynamic";
import AppLoadingSkeleton from "@/components/ui/AppLoadingSkeleton";

/* SW-4: code-split the 165KB Discuss app (realtime chat client) off the
   initial route bundle. Client-only (WebSocket/presence) so ssr:false is
   correct — nothing to SSR, no hydration mismatch. Skeleton avoids a blank
   flash while the chunk loads. Route/deep-link state unchanged. */
const DiscussApp = dynamic(() => import("@/components/discuss/DiscussApp"), {
  ssr: false,
  loading: () => <AppLoadingSkeleton label="Loading Discuss…" />,
});

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
