"use client";

/* ---------------------------------------------------------------------------
   /finance/* layout — the Aurora scope, the ground, and THE HEADER, once for
   29 routes.

   THE SCOPE GOES ON THE SEGMENT LAYOUT (the Scale Pattern). One `kx-app` here
   remaps the app's own tokens — --bg-primary to transparent, --bg-secondary to
   a translucent tint, the surface ramp to white 4/7/12% — so every panel, row,
   chip and hover across all twenty-nine finance routes turns translucent at
   once, the recessed-well field rules start matching every input/select/
   textarea unedited, and any route added to the segment later is converted the
   day it is created. Core keeps the solid values it always had, because every
   Aurora rule is scoped to the skin attribute.

   THE HEADER LIVES HERE TOO. Each page used to draw its own FinanceHeader, so
   a tab click unmounted the strip the operator had just clicked, showed the
   route loader in its place and rebuilt it on the next page — "each tab loads
   like I opened a new page". Now FinanceHeaderFrame is mounted once, above
   the keyed pane, and pages publish their title and actions into it (see
   finance-header-slot). The strip stays; only the pane below it changes and
   slides. The page container (max width, gutters) moves up here with it, so
   the sticky tab band keeps the whole page as its scroll context exactly as
   it did when the page owned both.

   Screens with their own chrome (ErpPage: approvals, data entry, FX rates,
   workspace) and the print route are rendered as before.

   `min-h-full`, never `min-h-screen`: the Hub shell already resolved the
   viewport maths, so a 100vh floor in here is one header-height taller than
   the area that can display it. These are flowing pages — they let the Hub
   scroller scroll them.
   --------------------------------------------------------------------------- */

import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import RouteTabPane from "@/components/ui/RouteTabPane";
import { FinanceHeaderFrame, hasHoistedHeader } from "@/components/finance/FinanceHeader";
import { useSkin } from "@/lib/appearance";

/* ssr:false and mounted only under Aurora — a canvas is the one thing the skin
   switch cannot do in CSS, so Core renders zero canvases (canon B). */
const WavyBackground = dynamic(() => import("@/components/ui/WavyBackground"), { ssr: false });

export default function FinanceLayout({ children }: { children: React.ReactNode }) {
  const aurora = useSkin() === "aurora";
  const pathname = usePathname() ?? "";

  /* The PDF snapshot of a report must carry no app chrome at all. */
  if (pathname.endsWith("/print")) return <>{children}</>;

  const hoisted = hasHoistedHeader(pathname);
  return (
    <div className={`${aurora ? "kx-app kx-ground-host " : ""}relative min-h-full bg-[var(--bg-primary)] text-[var(--text-primary)]`}>
      {aurora && (
        <div className="fixed inset-0 z-0 pointer-events-none" aria-hidden>
          <WavyBackground topLight />
        </div>
      )}
      {hoisted ? (
        <div className="mx-auto max-w-[1500px] px-4 pt-6 sm:px-6">
          <FinanceHeaderFrame />
          <RouteTabPane>{children}</RouteTabPane>
        </div>
      ) : (
        <RouteTabPane>{children}</RouteTabPane>
      )}
    </div>
  );
}
