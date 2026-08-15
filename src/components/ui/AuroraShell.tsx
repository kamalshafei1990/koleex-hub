"use client";

/* AuroraShell — the two lines every Aurora app root needs, in one place.
   ---------------------------------------------------------------------------
   Converting an app to Aurora is always the same two moves:

     1. `kx-app` on the root, which is the whole var-remap step — under the
        skin it turns --bg-primary transparent and --bg-secondary into a
        translucent tint, so every surface below inherits glass without being
        touched individually. Under Core the same class does nothing and the
        page stays solid.
     2. The ground behind it, so there is something for that transparency to
        show. Aurora only: Core has no ground by design.

   Written as a component because Quotations and InvoicesDoc each return from
   several branches — loading, list, editor — and repeating the pair at every
   `return` is four chances to convert three of them.

   NOT A LAYOUT. It adds no padding, no max-width, no flex. Anything it did to
   the box would have to be undone by every caller. */

import dynamic from "next/dynamic";
import type { ReactNode } from "react";
import { useSkin } from "@/lib/appearance";

const WavyBackground = dynamic(() => import("@/components/ui/WavyBackground"), { ssr: false });

export default function AuroraShell({
  children, className = "", topLight = true, dir,
}: {
  children: ReactNode;
  className?: string;
  /** Pull the ground's dark vignette away from the top — for apps whose
   *  header/toolbar zone runs deep, where the default floor reads as a slab. */
  topLight?: boolean;
  /** Forwarded because direction is a DOCUMENT property, not a style. An app
   *  that set dir on the root it replaced would otherwise lose its RTL the
   *  moment it adopted this shell — which in a trilingual Hub is not a
   *  cosmetic regression. */
  dir?: "rtl" | "ltr";
}) {
  const aurora = useSkin() === "aurora";
  return (
    <div dir={dir} className={`kx-app relative min-h-full bg-[var(--bg-primary)] text-[var(--text-primary)] ${className}`}>
      {aurora && (
        /* z-0 and inert: every child below renders above it without needing a
           z-index of its own, which is what keeps callers from having to think
           about stacking at all. */
        <div className="fixed inset-0 z-0 pointer-events-none" aria-hidden>
          <WavyBackground topLight={topLight} />
        </div>
      )}
      <div className="relative z-[1]">{children}</div>
    </div>
  );
}
