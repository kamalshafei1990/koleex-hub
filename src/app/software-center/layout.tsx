"use client";

/* Aurora scope + ground for the whole segment (the Scale Pattern: one
   layout converts every route in it, including ones added later).
   AuroraShell = kx-app (the var-remap) + the wavy ground under Aurora only;
   Core renders the original solid look untouched. */

import AuroraShell from "@/components/ui/AuroraShell";

export default function SegmentLayout({ children }: { children: React.ReactNode }) {
  return <AuroraShell>{children}</AuroraShell>;
}
