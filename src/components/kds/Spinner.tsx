"use client";

import SpinnerIcon from "@/components/icons/ui/SpinnerIcon";

/* KDS Spinner — ELECTED SP-1 (delegated pick, 2026-08-02): the
   SpinnerIcon arc, color inherited. Dim it for section loaders via
   className="text-[var(--text-dim)]". */

export default function Spinner({
  size = 16,
  className = "",
}: {
  size?: number;
  className?: string;
}) {
  return <SpinnerIcon size={size} className={`animate-spin ${className}`} />;
}
