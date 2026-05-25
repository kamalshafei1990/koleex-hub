"use client";

/* ---------------------------------------------------------------------------
   PurchasePage — shared shell every /purchase/* route page renders.

   Mirrors the Inventory shell pattern: outer min-h-screen container with
   max-w-[1500px] page width, then a PurchaseHeader (title + sticky pill
   menu + search) followed by the module's content. Centralizes:
     · The page-level wrapper styles (background, padding, max-width)
     · The PurchaseHeader props
     · Optional `action` slot for the create button
   so each route page stays under 30 lines and the chrome stays identical.
   --------------------------------------------------------------------------- */

import { type ReactNode } from "react";
import PurchaseHeader from "./PurchaseHeader";

export interface PurchasePageProps {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  controls?: ReactNode;
  children: ReactNode;
}

export default function PurchasePage({
  title,
  subtitle,
  action,
  controls,
  children,
}: PurchasePageProps) {
  return (
    <div className="min-h-screen bg-[var(--bg-primary)] pb-16 text-[var(--text-primary)] md:pb-6">
      <div className="mx-auto max-w-[1500px] space-y-5 px-4 py-6 sm:px-6">
        <PurchaseHeader
          title={title}
          subtitle={subtitle}
          action={action}
          controls={controls}
        />
        {children}
      </div>
    </div>
  );
}
