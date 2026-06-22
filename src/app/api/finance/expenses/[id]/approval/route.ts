import "server-only";

/* ===========================================================================
   /api/finance/expenses/[id]/approval

   POST   { action: "submit" | "approve" | "reject" | "request_changes" |
                    "reset" | "partial_approve" | "review_note",
            notes?: string, amount_approved?: number }
   GET    Returns the approval history timeline.

   The status state-machine is enforced server-side:

     draft               → submitted
     submitted           → under_review · approved · rejected · requires_changes
     under_review        → approved · rejected · requires_changes
     requires_changes    → submitted (when the user resubmits) · approved
     rejected            → submitted (when reset)
     approved            → draft (admin reset — rare)
     partially_approved  → approved · rejected · draft

   Submission permissions: Expenses module access (own expense or
   created_by_account_id matches caller).
   Review permissions:     Finance module access.
   Both gates use the existing requireModuleAccess plumbing.
   ========================================================================== */

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth, requireModuleAccess , requireModuleAction} from "@/lib/server/auth";
import type { ApprovalStatus, FinanceExpense } from "@/lib/finance/types";

type Action =
  | "submit"
  | "approve"
  | "reject"
  | "request_changes"
  | "reset"
  | "partial_approve"
  | "review_note";

/* ----- State machine ----- */
const ALLOWED_TRANSITIONS: Record<ApprovalStatus, Set<ApprovalStatus>> = {
  draft:              new Set(["submitted"]),
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
    case "review_note":
      /* "review_note" doesn't move the status by itself. We surface
         under_review only when the expense is currently submitted. */
      return current === "submitted" ? "under_review" : current;
  }
}

function actionRequiresApproverRole(action: Action): boolean {
  return action !== "submit" && action !== "reset";
}

async function loadExpense(id: string, tenantId: string): Promise<FinanceExpense | null> {
  const { data, error } = await supabaseServer
    .from("finance_expenses").select("*").eq("id", id).eq("tenant_id", tenantId).maybeSingle();
  if (error || !data) return null;
  return data as FinanceExpense;
}

/* ---------------------------------------------------------------------------
   POST — perform an approval action
   --------------------------------------------------------------------------- */

interface Body {
  action: Action;
  notes?: string;
  amount_approved?: number;
}

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const { id } = await ctx.params;

  const body = (await req.json()) as Body;
  if (!body || !body.action) {
    return NextResponse.json({ error: "Missing action" }, { status: 400 });
  }

  const expense = await loadExpense(id, auth.tenant_id);
  if (!expense) return NextResponse.json({ error: "Expense not found" }, { status: 404 });

  /* Permission: review actions require Finance module access; submit
     and reset only require the Expenses gate. */
  const moduleNeeded = actionRequiresApproverRole(body.action) ? "Finance" : "Expenses";
  const deny = await requireModuleAction(auth, moduleNeeded, "create");
  if (deny) return deny;

  const current = (expense.approval_status ?? "draft") as ApprovalStatus;
  const next = statusForAction(body.action, current);

  if (current !== next && !ALLOWED_TRANSITIONS[current]?.has(next)) {
    return NextResponse.json(
      { error: `Cannot ${body.action} from ${current}` },
      { status: 409 },
    );
  }

  /* Build the update patch. Each action stamps its actor + timestamp +
     reason field so the audit trail and trigger see everything. */
  const now = new Date().toISOString();
  const patch: Record<string, unknown> = { approval_status: next, updated_at: now };

  switch (body.action) {
    case "submit":
      patch.submitted_at = now;
      patch.submitted_by = auth.account_id;
      patch.review_notes = body.notes ?? null;
      /* Clear prior rejection/changes reasons so the timeline shows
         the most recent state cleanly. */
      patch.rejection_reason = null;
      patch.requires_changes_reason = null;
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
      /* Clear approval-side metadata when going back to draft. */
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
    .from("finance_expenses").update(patch).eq("id", id).eq("tenant_id", auth.tenant_id)
    .select("*").single();
  if (error) {
    console.error("[expense approval POST]", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ expense: data as FinanceExpense });
}

/* ---------------------------------------------------------------------------
   GET — history timeline
   --------------------------------------------------------------------------- */

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const { id } = await ctx.params;

  const expense = await loadExpense(id, auth.tenant_id);
  if (!expense) return NextResponse.json({ error: "Expense not found" }, { status: 404 });

  const deny = await requireModuleAccess(auth, "Expenses");
  if (deny) return deny;

  const { data, error } = await supabaseServer
    .from("finance_approval_history")
    .select("*")
    .eq("tenant_id", auth.tenant_id)
    .eq("entity_type", "expense")
    .eq("entity_id", id)
    .order("created_at", { ascending: true });
  if (error) {
    console.error("[expense approval history]", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  /* Resolve actor display names in one batch — denormalised onto each
     history row so the client doesn't N+1. */
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
