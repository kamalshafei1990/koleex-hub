import "server-only";

/* ===========================================================================
   /api/finance/payments/[id]/approval

   Mirror of /api/finance/expenses/[id]/approval but for payments. Same
   state machine, same finance_approval_history table, same actor
   stamping. The DB trigger on finance_payments logs every status
   change automatically.

   Permission gates:
     · submit / reset      → Finance module (operator)
     · approve / reject /
       request_changes /
       partial_approve      → Finance module + (future) elevated role check
                              For Phase 2.3 we lean on the module gate; a
                              tier-based check based on payment amount can
                              layer in later via payment-thresholds.ts.
   ========================================================================== */

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth, requireModuleAccess , requireModuleAction} from "@/lib/server/auth";
import { isAutoApprovable } from "@/lib/finance/payment-thresholds";
import type { ApprovalStatus, FinancePayment } from "@/lib/finance/types";

type Action =
  | "submit"
  | "approve"
  | "reject"
  | "request_changes"
  | "reset"
  | "partial_approve"
  | "review_note";

const ALLOWED_TRANSITIONS: Record<ApprovalStatus, Set<ApprovalStatus>> = {
  draft:              new Set(["submitted", "approved"]),  // auto-approve shortcut for tier=auto
  submitted:          new Set(["under_review", "approved", "rejected", "requires_changes", "partially_approved", "draft"]),
  under_review:       new Set(["approved", "rejected", "requires_changes", "partially_approved", "submitted", "draft"]),
  requires_changes:   new Set(["submitted", "approved", "draft"]),
  rejected:           new Set(["submitted", "draft"]),
  approved:           new Set(["draft"]),
  partially_approved: new Set(["approved", "rejected", "draft"]),
};

function statusForAction(action: Action, current: ApprovalStatus): ApprovalStatus {
  switch (action) {
    case "submit":             return "submitted";
    case "approve":            return "approved";
    case "reject":             return "rejected";
    case "request_changes":    return "requires_changes";
    case "reset":              return "draft";
    case "partial_approve":    return "partially_approved";
    case "review_note":        return current === "submitted" ? "under_review" : current;
  }
}

async function loadPayment(id: string, tenantId: string): Promise<FinancePayment | null> {
  const { data, error } = await supabaseServer
    .from("finance_payments").select("*").eq("id", id).eq("tenant_id", tenantId).maybeSingle();
  if (error || !data) return null;
  return data as FinancePayment;
}

interface Body {
  action: Action;
  notes?: string;
}

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const { id } = await ctx.params;

  const body = (await req.json()) as Body;
  if (!body || !body.action) {
    return NextResponse.json({ error: "Missing action" }, { status: 400 });
  }

  const payment = await loadPayment(id, auth.tenant_id);
  if (!payment) return NextResponse.json({ error: "Payment not found" }, { status: 404 });

  const deny = await requireModuleAction(auth, "Finance", "create");
  if (deny) return deny;

  const current = (payment.approval_status ?? "draft") as ApprovalStatus;
  /* Auto-approve shortcut: when an operator submits a payment whose
     amount is below the auto-approve threshold, jump straight to
     approved. This keeps the bank-fee / tiny-expense workflow fast. */
  const wantsSubmit = body.action === "submit";
  const next = wantsSubmit && current === "draft" && isAutoApprovable(payment.expected_amount ?? payment.amount)
    ? "approved"
    : statusForAction(body.action, current);

  if (current !== next && !ALLOWED_TRANSITIONS[current]?.has(next)) {
    return NextResponse.json({ error: `Cannot ${body.action} from ${current}` }, { status: 409 });
  }

  const now = new Date().toISOString();
  const patch: Record<string, unknown> = { approval_status: next, updated_at: now };

  switch (body.action) {
    case "submit":
      patch.submitted_at = now;
      patch.submitted_by = auth.account_id;
      patch.review_notes = body.notes ?? null;
      patch.rejection_reason = null;
      patch.requires_changes_reason = null;
      /* When auto-approved, also stamp the approver columns so the
         audit log + UI can show consistent state. */
      if (next === "approved") {
        patch.approved_at = now;
        patch.approved_by = auth.account_id;
        patch.reviewed_at = now;
        patch.reviewed_by = auth.account_id;
      }
      break;
    case "review_note":
      patch.reviewed_at = now;
      patch.reviewed_by = auth.account_id;
      patch.review_notes = body.notes ?? null;
      break;
    case "approve":
    case "partial_approve":
      patch.approved_at = now;
      patch.approved_by = auth.account_id;
      patch.reviewed_at = now;
      patch.reviewed_by = auth.account_id;
      patch.review_notes = body.notes ?? null;
      patch.rejection_reason = null;
      patch.requires_changes_reason = null;
      break;
    case "reject":
      if (!body.notes || body.notes.trim().length === 0) {
        return NextResponse.json({ error: "Rejection reason required" }, { status: 400 });
      }
      patch.rejected_at = now;
      patch.rejected_by = auth.account_id;
      patch.reviewed_at = now;
      patch.reviewed_by = auth.account_id;
      patch.rejection_reason = body.notes.trim();
      patch.review_notes = body.notes.trim();
      break;
    case "request_changes":
      if (!body.notes || body.notes.trim().length === 0) {
        return NextResponse.json({ error: "Reason for changes required" }, { status: 400 });
      }
      patch.reviewed_at = now;
      patch.reviewed_by = auth.account_id;
      patch.requires_changes_reason = body.notes.trim();
      patch.review_notes = body.notes.trim();
      break;
    case "reset":
      patch.submitted_at = null;
      patch.reviewed_at = null;
      patch.approved_at = null;
      patch.rejected_at = null;
      patch.rejection_reason = null;
      patch.requires_changes_reason = null;
      patch.review_notes = null;
      break;
  }

  const { data, error } = await supabaseServer
    .from("finance_payments").update(patch).eq("id", id).eq("tenant_id", auth.tenant_id)
    .select("*").single();
  if (error) {
    console.error("[payment approval POST]", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ payment: data as FinancePayment, auto_approved: wantsSubmit && next === "approved" });
}

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const { id } = await ctx.params;

  const payment = await loadPayment(id, auth.tenant_id);
  if (!payment) return NextResponse.json({ error: "Payment not found" }, { status: 404 });

  const deny = await requireModuleAccess(auth, "Finance");
  if (deny) return deny;

  const { data, error } = await supabaseServer
    .from("finance_approval_history")
    .select("*")
    .eq("tenant_id", auth.tenant_id)
    .eq("entity_type", "payment")
    .eq("entity_id", id)
    .order("created_at", { ascending: true });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  /* Resolve actor display names in one batch — same pattern as the
     expense endpoint. */
  const actorIds = Array.from(new Set((data ?? []).map((h) => (h as { actor_id: string | null }).actor_id).filter(Boolean) as string[]));
  let actorMap = new Map<string, string>();
  if (actorIds.length > 0) {
    const { data: actors } = await supabaseServer
      .from("accounts").select("id, username, login_email").in("id", actorIds);
    if (actors) {
      actorMap = new Map(
        (actors as Array<{ id: string; username: string | null; login_email: string }>)
          .map((a) => [a.id, a.username || a.login_email.split("@")[0]]),
      );
    }
  }
  const history = (data ?? []).map((h) => ({
    ...(h as Record<string, unknown>),
    actor_name: (h as { actor_id?: string | null }).actor_id
      ? actorMap.get((h as { actor_id: string }).actor_id) ?? null
      : null,
  }));

  return NextResponse.json({ history });
}
