import "server-only";

/* ===========================================================================
   Lightweight approval layer.

   Four entity kinds share a common four-status lifecycle:
     draft → submitted → approved | rejected

   The underlying tables already carry approval_status + reviewer fields
   (we just added them to vendor_bills + journals). This module provides
   one transition API + a unified pending-queue reader + an activity log
   writer.

   No new RBAC framework. Visibility/permission is decided at the route
   layer using src/lib/experience (CEO/Accountant can approve; everyone
   can submit; warehouse/sales cannot see cost-sensitive items).
   ========================================================================== */

import { supabaseServer } from "@/lib/server/supabase-server";

export type ApprovalEntity = "expense" | "payment" | "bill" | "journal";
export type ApprovalAction = "submit" | "approve" | "reject";
export type ApprovalStatus = "draft" | "submitted" | "pending" | "approved" | "rejected";

const TABLE: Record<ApprovalEntity, string> = {
  expense: "finance_expenses",
  payment: "finance_payments",
  bill:    "vendor_bills",
  journal: "accounting_journal_entries",
};

const ACTIVE_STATES: ApprovalStatus[] = ["draft", "submitted", "pending"];

export interface TransitionInput {
  tenantId: string;
  actorId: string;
  entity: ApprovalEntity;
  entityId: string;
  action: ApprovalAction;
  note?: string;
  reason?: string;     // required when action='reject'
}

export interface TransitionResult {
  ok: boolean;
  status?: ApprovalStatus;
  error?: string;
  code?: number;
}

/* ─── Activity log writer ─── */

export async function logActivity(opts: {
  tenantId: string; actorId: string | null;
  entity: ApprovalEntity; entityId: string;
  action: "created" | "updated" | "submitted" | "approved" | "rejected" | "voided";
  note?: string | null;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  await supabaseServer.from("finance_activity_log").insert({
    tenant_id: opts.tenantId,
    entity_kind: opts.entity,
    entity_id: opts.entityId,
    action: opts.action,
    actor_id: opts.actorId,
    note: opts.note ?? null,
    metadata: opts.metadata ?? {},
  });
}

/* ─── Transition ─── */

export async function transitionApproval(input: TransitionInput): Promise<TransitionResult> {
  const table = TABLE[input.entity];
  if (!table) return { ok: false, error: "Unknown entity kind.", code: 400 };

  const cur = await supabaseServer.from(table)
    .select("id, approval_status").eq("id", input.entityId).eq("tenant_id", input.tenantId).maybeSingle();
  if (cur.error || !cur.data) return { ok: false, error: "Not found.", code: 404 };
  const status = ((cur.data as { approval_status: ApprovalStatus }).approval_status ?? "draft");

  let nextStatus: ApprovalStatus;
  const patch: Record<string, string | null> = {};
  const now = new Date().toISOString();

  switch (input.action) {
    case "submit":
      if (!["draft", "rejected"].includes(status))
        return { ok: false, error: `Cannot submit from '${status}'.`, code: 409 };
      nextStatus = "submitted";
      patch.approval_status = nextStatus;
      patch.submitted_at = now;
      patch.submitted_by = input.actorId;
      break;
    case "approve":
      if (!["submitted", "pending"].includes(status))
        return { ok: false, error: `Cannot approve from '${status}'.`, code: 409 };
      nextStatus = "approved";
      patch.approval_status = nextStatus;
      patch.approved_at = now;
      patch.approved_by = input.actorId;
      break;
    case "reject":
      if (!["submitted", "pending"].includes(status))
        return { ok: false, error: `Cannot reject from '${status}'.`, code: 409 };
      if (!input.reason || input.reason.trim().length < 3)
        return { ok: false, error: "Rejection reason required (min 3 chars).", code: 422 };
      nextStatus = "rejected";
      patch.approval_status = nextStatus;
      patch.rejected_at = now;
      patch.rejected_by = input.actorId;
      patch.rejection_reason = input.reason;
      break;
    default:
      return { ok: false, error: "Unknown action.", code: 400 };
  }

  const upd = await supabaseServer.from(table)
    .update(patch).eq("id", input.entityId).eq("tenant_id", input.tenantId);
  if (upd.error) return { ok: false, error: upd.error.message, code: 500 };

  const actionToLog: "submitted" | "approved" | "rejected" =
    input.action === "submit"  ? "submitted" :
    input.action === "approve" ? "approved"  : "rejected";
  await logActivity({
    tenantId: input.tenantId, actorId: input.actorId,
    entity: input.entity, entityId: input.entityId,
    action: actionToLog,
    note: input.note ?? input.reason ?? null,
  });

  return { ok: true, status: nextStatus };
}

/* ─── Unified pending queue ─── */

export interface PendingItem {
  kind: ApprovalEntity;
  id: string;
  ref: string;
  amount: number;
  currency: string;
  status: ApprovalStatus;
  submitted_at: string | null;
  party_name: string | null;
  href: string;
}

export async function listPending(tenantId: string): Promise<PendingItem[]> {
  const [expRes, payRes, billRes, jeRes] = await Promise.all([
    supabaseServer.from("finance_expenses")
      .select("id, title, amount, currency, approval_status, submitted_at, linked_supplier_id")
      .eq("tenant_id", tenantId).in("approval_status", ACTIVE_STATES),
    supabaseServer.from("finance_payments")
      .select("id, reference_no, amount, currency, approval_status, submitted_at, party_name")
      .eq("tenant_id", tenantId).in("approval_status", ACTIVE_STATES),
    supabaseServer.from("vendor_bills")
      .select("id, bill_no, total, currency, approval_status, submitted_at, supplier_id")
      .eq("tenant_id", tenantId).in("approval_status", ACTIVE_STATES),
    supabaseServer.from("accounting_journal_entries")
      .select("id, journal_no, approval_status, submitted_at, description")
      .eq("tenant_id", tenantId).in("approval_status", ACTIVE_STATES),
  ]);

  const out: PendingItem[] = [];
  for (const e of (expRes.data ?? []) as Array<{
    id: string; title: string | null; amount: number; currency: string;
    approval_status: ApprovalStatus; submitted_at: string | null; linked_supplier_id: string | null;
  }>) {
    out.push({
      kind: "expense", id: e.id, ref: e.title ?? e.id.slice(0, 8),
      amount: Number(e.amount) || 0, currency: e.currency || "—",
      status: e.approval_status, submitted_at: e.submitted_at,
      party_name: null, href: `/finance/expenses?id=${e.id}`,
    });
  }
  for (const p of (payRes.data ?? []) as Array<{
    id: string; reference_no: string | null; amount: number; currency: string;
    approval_status: ApprovalStatus; submitted_at: string | null; party_name: string | null;
  }>) {
    out.push({
      kind: "payment", id: p.id, ref: p.reference_no ?? p.id.slice(0, 8),
      amount: Number(p.amount) || 0, currency: p.currency || "—",
      status: p.approval_status, submitted_at: p.submitted_at,
      party_name: p.party_name, href: `/finance/payments?id=${p.id}`,
    });
  }
  for (const b of (billRes.data ?? []) as Array<{
    id: string; bill_no: string | null; total: number; currency: string;
    approval_status: ApprovalStatus; submitted_at: string | null; supplier_id: string;
  }>) {
    out.push({
      kind: "bill", id: b.id, ref: b.bill_no ?? b.id.slice(0, 8),
      amount: Number(b.total) || 0, currency: b.currency || "—",
      status: b.approval_status, submitted_at: b.submitted_at,
      party_name: null, href: `/finance/suppliers?bill=${b.id}`,
    });
  }
  for (const j of (jeRes.data ?? []) as Array<{
    id: string; journal_no: string; approval_status: ApprovalStatus;
    submitted_at: string | null; description: string | null;
  }>) {
    out.push({
      kind: "journal", id: j.id, ref: j.journal_no,
      amount: 0, currency: "—",
      status: j.approval_status, submitted_at: j.submitted_at,
      party_name: j.description, href: `/finance/accounting?journal=${j.id}`,
    });
  }
  out.sort((a, b) => (b.submitted_at ?? "").localeCompare(a.submitted_at ?? ""));
  return out;
}

/* ─── Activity reader ─── */

export interface ActivityRow {
  id: string;
  entity_kind: ApprovalEntity;
  entity_id: string;
  action: string;
  actor_id: string | null;
  actor_label: string | null;
  note: string | null;
  created_at: string;
}

export async function listActivity(tenantId: string, opts: {
  entity?: ApprovalEntity; entityId?: string; limit?: number;
} = {}): Promise<ActivityRow[]> {
  let q = supabaseServer.from("finance_activity_log")
    .select("id, entity_kind, entity_id, action, actor_id, note, created_at")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false })
    .limit(opts.limit ?? 50);
  if (opts.entity)   q = q.eq("entity_kind", opts.entity);
  if (opts.entityId) q = q.eq("entity_id",   opts.entityId);

  const { data } = await q;
  const rows = (data ?? []) as Array<{
    id: string; entity_kind: ApprovalEntity; entity_id: string;
    action: string; actor_id: string | null; note: string | null; created_at: string;
  }>;
  const actorIds = Array.from(new Set(rows.map((r) => r.actor_id).filter(Boolean) as string[]));
  let nameMap = new Map<string, string>();
  if (actorIds.length > 0) {
    const acc = await supabaseServer.from("accounts")
      .select("id, username").in("id", actorIds);
    nameMap = new Map(((acc.data ?? []) as Array<{ id: string; username: string }>).map((a) => [a.id, a.username]));
  }
  return rows.map((r) => ({
    ...r,
    actor_label: r.actor_id ? nameMap.get(r.actor_id) ?? r.actor_id.slice(0, 8) : null,
  }));
}

/* ─── Permission helper ─── */

import type { DashboardRole } from "@/lib/experience";

export function canApprove(role: DashboardRole, isSuperAdmin: boolean): boolean {
  if (isSuperAdmin) return true;
  return role === "ceo" || role === "accountant";
}
