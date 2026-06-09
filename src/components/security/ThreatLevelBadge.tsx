/* ThreatLevelBadge — Quiet / Elevated / High indicator (Phase 2A · A2).
   Distinct from RiskBadge — this reflects the live attack‑pressure level.
   Text label always present; RSC-safe. */

import type { ThreatLevel, Tone } from "@/lib/security/view-model";
import { TONE_TEXT, TONE_DOT } from "./tokens";

const THREAT: Record<ThreatLevel, { tone: Tone; label: string }> = {
  quiet: { tone: "calm", label: "Quiet" },
  elevated: { tone: "attention", label: "Elevated" },
  high: { tone: "critical", label: "High" },
};

export interface ThreatLevelBadgeProps {
  level: ThreatLevel;
  className?: string;
}

export default function ThreatLevelBadge({ level, className = "" }: ThreatLevelBadgeProps) {
  const { tone, label } = THREAT[level];
  return (
    <span
      aria-label={`Threat level: ${label}`}
      className={`inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--bg-surface)] px-2.5 py-1 text-xs font-medium ${TONE_TEXT[tone]} ${className}`}
    >
      <span className={`h-2 w-2 rounded-full ${TONE_DOT[tone]}`} aria-hidden="true" />
      {label}
    </span>
  );
}
