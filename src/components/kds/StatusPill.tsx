"use client";
/* KDS StatusPill — THE pill. One shape for every status chip in the Hub. */
import type { ReactNode } from "react";

const TONES = {
  neutral: "bg-[var(--bg-inverted)]/[0.06] text-[var(--text-muted)] border-[var(--border-subtle)]",
  brand:   "bg-[#567FB2]/15 text-[#7FA9D6] border-[#567FB2]/40",
  success: "bg-[#10B981]/12 text-[#10B981] border-[#10B981]/35",
  warning: "bg-[#F59E0B]/12 text-[#F59E0B] border-[#F59E0B]/35",
  error:   "bg-[#FF3333]/12 text-[#FF3333] border-[#FF3333]/35",
} as const;

export default function StatusPill({
  tone = "neutral", children, className = "",
}: { tone?: keyof typeof TONES; children: ReactNode; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1 h-[22px] px-2 rounded-full border text-[11px] font-semibold whitespace-nowrap ${TONES[tone]} ${className}`}>
      {children}
    </span>
  );
}
