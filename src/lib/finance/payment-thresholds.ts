/* ===========================================================================
   Payment approval thresholds  —  Phase 2.3

   Pure function table mapping (amount, direction) → required approval
   tier. The tiering is intentionally simple — future phases can layer
   role-based routing on top without rewriting the contract.

     · under USD 500          → auto-approved
     · USD 500–5,000          → finance-manager approval
     · USD 5,000–25,000       → executive approval
     · over USD 25,000        → final approval (CEO / CFO)

   The auth/permission layer continues to be the actual gate; this
   helper just tells the UI and the intelligence layer "how many
   eyes does this payment legitimately need?"
   ========================================================================== */

export type ApprovalTier =
  | "auto"
  | "finance_manager"
  | "executive"
  | "final";

export interface ApprovalTierDescriptor {
  tier: ApprovalTier;
  label: string;
  /** Min amount (inclusive). */
  min: number;
  /** Max amount (exclusive). null = no upper bound. */
  max: number | null;
}

export const APPROVAL_TIERS: ApprovalTierDescriptor[] = [
  { tier: "auto",            label: "Auto-approved",            min: 0,        max: 500     },
  { tier: "finance_manager", label: "Finance manager approval", min: 500,      max: 5_000   },
  { tier: "executive",       label: "Executive approval",        min: 5_000,    max: 25_000  },
  { tier: "final",           label: "Final approval",            min: 25_000,   max: null    },
];

export function approvalTierForAmount(amount: number | null | undefined): ApprovalTierDescriptor {
  const v = Math.abs(Number(amount) || 0);
  for (const t of APPROVAL_TIERS) {
    if (v >= t.min && (t.max == null || v < t.max)) return t;
  }
  return APPROVAL_TIERS[0];
}

/** True when the payment's amount qualifies for the auto-approved tier. */
export function isAutoApprovable(amount: number | null | undefined): boolean {
  return approvalTierForAmount(amount).tier === "auto";
}

/** Convenience: format a "Why does this need approval?" hint. */
export function approvalTierExplanation(amount: number | null | undefined): string {
  const t = approvalTierForAmount(amount);
  switch (t.tier) {
    case "auto":
      return "Below the manager-approval threshold (USD 500) — auto-approvable.";
    case "finance_manager":
      return "Requires finance-manager approval (USD 500 – 5,000 band).";
    case "executive":
      return "Requires executive approval (USD 5,000 – 25,000 band).";
    case "final":
      return "Requires final approval (USD 25,000+ band).";
  }
}
