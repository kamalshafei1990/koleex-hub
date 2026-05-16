"use client";

/* ===========================================================================
   ReconciliationBadge  —  Phase 2.3

   Calm monochrome chip representing a payment's bank-reconciliation
   state. Sits next to the ApprovalBadge on each payment row. Same
   visual vocabulary as the rest of Hub: dot + label + optional tiny
   count pill. No saturated fills, no emoji, no rainbow.
   ========================================================================== */

import type { ReconciliationStatus } from "@/lib/finance/types";

const STYLES: Record<ReconciliationStatus, { dot: string; cls: string; label: string }> = {
  unreconciled: {
    dot: "bg-white/40",
    cls: "text-gray-300 bg-white/[0.04] border-white/[0.06]",
    label: "Unreconciled",
  },
  matched: {
    dot: "bg-emerald-400/85",
    cls: "text-emerald-300 bg-emerald-500/[0.08] border-emerald-500/[0.18]",
    label: "Matched",
  },
  partially_matched: {
    dot: "bg-emerald-300/75",
    cls: "text-emerald-300/90 bg-emerald-500/[0.06] border-emerald-500/[0.14]",
    label: "Partial match",
  },
  mismatch: {
    dot: "bg-rose-400/85",
    cls: "text-rose-300 bg-rose-500/[0.08] border-rose-500/[0.18]",
    label: "Mismatch",
  },
  disputed: {
    dot: "bg-rose-400/85",
    cls: "text-rose-300 bg-rose-500/[0.08] border-rose-500/[0.18]",
    label: "Disputed",
  },
  verified: {
    dot: "bg-emerald-400/95",
    cls: "text-emerald-300 bg-emerald-500/[0.10] border-emerald-500/[0.22]",
    label: "Verified",
  },
};

export function ReconciliationBadge({
  status,
  compact = false,
}: {
  status: ReconciliationStatus | undefined;
  compact?: boolean;
}) {
  const s = STYLES[status ?? "unreconciled"];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-1.5 py-0.5 text-[10px] font-medium ${s.cls}`}
      title={s.label}
    >
      <span aria-hidden className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />
      <span>{compact ? labelCompact(status ?? "unreconciled") : s.label}</span>
    </span>
  );
}

function labelCompact(s: ReconciliationStatus): string {
  switch (s) {
    case "unreconciled":      return "Unrec.";
    case "matched":           return "Matched";
    case "partially_matched": return "Partial";
    case "mismatch":          return "Mismatch";
    case "disputed":          return "Disputed";
    case "verified":          return "Verified";
  }
}
