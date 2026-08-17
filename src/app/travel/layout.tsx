"use client";

/* ---------------------------------------------------------------------------
   /travel/* layout — the Aurora scope + the ground, once for the whole segment.

   Built Aurora-first: Travel is the first app added after the conversion
   programme, so it never carries a Core-only phase to migrate later.

   THE SCOPE GOES ON THE SEGMENT LAYOUT, NOT PER PAGE (the Scale Pattern).
   One `kx-app` here remaps the app's own tokens, so every panel, chip, row and
   form field across /travel, /travel/[id] and the settings screen turns
   translucent at once.

   HEIGHT: `h-full`, never `min-h-screen` and never a dvh calc. The Hub shell
   already resolved the viewport maths — `.kx-shell-top` is the 100vh box and
   `#main-scroll-container` is the scroller inside it — so measuring the
   viewport a second time lands one header-height too tall and buys a phantom
   scrollbar on short pages.

   THE PRINT ROUTE OPTS OUT. /travel/[id]/print renders paper — black on
   white, no glass, no canvas — but Next.js nests layouts, so it inherits this
   one whether or not that is wanted. It is excluded explicitly below rather
   than moved into a route group, because a group would put the print page in
   a second tree that no longer shares this segment's URL shape.
   --------------------------------------------------------------------------- */

import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import { useSkin } from "@/lib/appearance";

/* ssr:false and mounted only under Aurora — a canvas is the one thing the skin
   switch cannot do in CSS, so Core renders zero canvases (canon B). */
const WavyBackground = dynamic(() => import("@/components/ui/WavyBackground"), { ssr: false });

export default function TravelLayout({ children }: { children: React.ReactNode }) {
  const aurora = useSkin() === "aurora";
  const pathname = usePathname();

  /* Paper renders bare: no scope, no ground, no height box. Anything this
     layout would add is chrome, and chrome inside a printed PDF is a defect. */
  if (pathname?.endsWith("/print")) return <>{children}</>;

  return (
    <div
      className={`${aurora ? "kx-app kx-ground-host " : ""}relative h-full bg-[var(--bg-primary)] text-[var(--text-primary)]`}
    >
      {aurora && (
        /* fixed, never absolute, so the ground stays put while the page
           scrolls; inert so it never eats a click meant for the app. */
        <div className="fixed inset-0 z-0 pointer-events-none" aria-hidden>
          <WavyBackground topLight />
        </div>
      )}
      {children}
    </div>
  );
}
