"use client";

/* ---------------------------------------------------------------------------
   PurchaseRouteShell — shared route shell for every /purchase/* page.

   Centralizes the page-level wrapper (background, max-width, padding)
   AND the canonical PurchaseHeader, so each route file is now a 6-line
   shell that doesn't duplicate the layout boilerplate.

   ⚠ Modules rendered as children MUST NOT add their own `p-4 md:p-6`
   wrapper — this shell already pads. The earlier double-padding bug
   (route adds px-4 sm:px-6 + module adds p-4 md:p-6) shoved content
   32px in on mobile and produced an unbalanced left rail.
   --------------------------------------------------------------------------- */

import { type ReactNode } from "react";
import PurchaseHeader from "./PurchaseHeader";

interface PurchaseRouteShellProps {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  controls?: ReactNode;
  children: ReactNode;
}

export default function PurchaseRouteShell({
  title,
  subtitle,
  action,
  controls,
  children,
}: PurchaseRouteShellProps) {
  return (
    <div className="min-h-screen bg-[var(--bg-primary)] pb-16 text-[var(--text-primary)] md:pb-6">
      <div className="mx-auto max-w-[1500px] space-y-5 px-4 py-6 sm:px-6">
        <PurchaseHeader title={title} subtitle={subtitle} action={action} controls={controls} />
        {children}
      </div>
    </div>
  );
}
