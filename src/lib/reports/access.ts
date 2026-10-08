/* ---------------------------------------------------------------------------
   Reports — WHO MAY READ A REPORT. One rule, written once, pure.

   Owner decisions (25 Sep 2026):
     1. A confidential report is read by its author and its recipients —
        nobody else, not even a super admin.
     2. A manager reads the reports of the people under them, all the way up
        the chain, except confidential ones.
   Plus the obvious: a draft is the author's alone until it is sent.

   The server (loadForViewer in src/lib/server/reports/core.ts) gathers the facts and asks
   this function; validate:reports runs it against every case below so a
   later edit cannot quietly widen it.
   --------------------------------------------------------------------------- */

export interface ReportAccessFacts {
  status: "draft" | "submitted" | "approved" | "returned";
  confidential: boolean;
  authorAccountId: string;
  recipientIds: string[];
  /** Account ids of the author's managers, nearest first. */
  managerChain: string[];
}

export interface ReportViewer {
  accountId: string;
  isSuperAdmin: boolean;
}

export type ReportAccess = "author" | "recipient" | "manager" | "super_admin" | null;

export function reportAccess(f: ReportAccessFacts, v: ReportViewer): ReportAccess {
  if (v.accountId === f.authorAccountId) return "author";
  if (f.status === "draft") return null;
  if (f.recipientIds.includes(v.accountId)) return "recipient";
  if (f.confidential) return null;
  if (f.managerChain.includes(v.accountId)) return "manager";
  if (v.isSuperAdmin) return "super_admin";
  return null;
}
