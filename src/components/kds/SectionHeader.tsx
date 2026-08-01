"use client";
/* KDS SectionHeader — the shared section language (law §5). */
import type { ReactNode } from "react";
export default function SectionHeader({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex items-center gap-2.5 mb-3">
      <span className="text-[11px] font-semibold tracking-[1px] uppercase text-[var(--text-ghost)]">{children}</span>
      <div className="flex-1 h-px bg-[var(--bg-inverted)]/[0.06]" />
      {action}
    </div>
  );
}
