"use client";

/* Aurora scope + ground for CEO Brand, like Social Marketing's segment. */

import AuroraShell from "@/components/ui/AuroraShell";

export default function SegmentLayout({ children }: { children: React.ReactNode }) {
  return <AuroraShell>{children}</AuroraShell>;
}
