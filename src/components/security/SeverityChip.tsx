/* SeverityChip — small severity pill (Phase 2A · A2).
   Color is NEVER the only signal: a text label always accompanies the dot.
   RSC-safe, read-only. */

import type { Severity } from "@/lib/security/view-model";
import { TONE_TEXT, TONE_DOT, SEVERITY_TONE, SEVERITY_LABEL } from "./tokens";

export interface SeverityChipProps {
  severity: Severity;
  /** Override the default label ("Info" / "Review" / "Action"). */
  label?: string;
  className?: string;
}

export default function SeverityChip({ severity, label, className = "" }: SeverityChipProps) {
  const tone = SEVERITY_TONE[severity];
  const text = label ?? SEVERITY_LABEL[severity];
  return (
    <span
      title={`Severity: ${text}`}
      className={`inline-flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--bg-surface)] px-2 py-0.5 text-[11px] ${TONE_TEXT[tone]} ${className}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${TONE_DOT[tone]}`} aria-hidden="true" />
      {text}
    </span>
  );
}
