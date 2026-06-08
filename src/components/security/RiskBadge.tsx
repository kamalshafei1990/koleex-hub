/* RiskBadge — low/medium/high risk badge (Phase 2A · A2).
   Text label always present (color is not the only signal). RSC-safe. */

import type { Tone } from "@/lib/security/view-model";
import { TONE_TEXT, TONE_DOT } from "./tokens";

export type RiskLevel = "low" | "medium" | "high";

const RISK: Record<RiskLevel, { tone: Tone; label: string }> = {
  low: { tone: "calm", label: "Low" },
  medium: { tone: "attention", label: "Medium" },
  high: { tone: "critical", label: "High" },
};

export interface RiskBadgeProps {
  level: RiskLevel;
  label?: string;
  className?: string;
}

export default function RiskBadge({ level, label, className = "" }: RiskBadgeProps) {
  const { tone, label: def } = RISK[level];
  const text = label ?? def;
  return (
    <span
      title={`Risk: ${text}`}
      className={`inline-flex items-center gap-1.5 rounded-md border border-[var(--border)] bg-[var(--bg-surface)] px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide ${TONE_TEXT[tone]} ${className}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${TONE_DOT[tone]}`} aria-hidden="true" />
      {text}
    </span>
  );
}
