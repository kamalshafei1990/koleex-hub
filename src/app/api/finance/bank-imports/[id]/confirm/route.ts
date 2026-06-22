import "server-only";

/* ===========================================================================
   POST /api/finance/bank-imports/[id]/confirm

   Phase S.1A — Transactional integrity hardening.

   The previous implementation:
     · Loaded the import + ready rows
     · Inserted N cash movements in a single SQL call (atomic)
     · THEN looped row-by-row to update each row's import_status
       and matched_cash_movement_id (non-atomic with the insert)
     · THEN flipped import.status='confirmed' (still in the same loop window)

   Two operators clicking "Confirm import" concurrently could both
   succeed: the second one would insert a second copy of every cash
   movement before the first finished its row-linking loop.

   This route now defers the entire confirmation to
   `fn_bank_import_confirm` which:

     · Pins import.status='parsed' → 'confirmed' atomically. Loser
       receives 409. Only one operator can flip the gate.
     · Verifies the bank account is still 'active' (or 409 + rollback).
     · Inserts cash movements + links rows in ONE data-modifying CTE
       so the insert + linkage cannot drift even on transaction abort.
     · Writes a consolidated audit row once.

   The reconciliation rescan stays in the API route because it runs
   AFTER the transaction commits — the engine needs to read the newly-
   inserted movements. A rescan failure is non-fatal; the operator
   can rescan manually from the queue.
   ========================================================================== */

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth, requireModuleAccess , requireModuleAction} from "@/lib/server/auth";
import type {
  BankStatementImport,
  CashMovement,
  FinancePayment,
} from "@/lib/finance/types";
import { planCandidates } from "@/lib/finance/reconciliation-engine";

interface RpcResult {
  ok?: boolean;
  error?: string;
  code?: number;
  status?: string;
  import?: BankStatementImport;
  imported_count?: number;
}

export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAction(auth, "Finance", "edit");
  if (deny) return deny;
  const { id } = await ctx.params;

  /* ── 1. Atomic confirm + insert + link via PG function. ── */
  const { data, error } = await supabaseServer.rpc("fn_bank_import_confirm", {
    p_import_id: id,
    p_tenant_id: auth.tenant_id,
    p_actor_id:  auth.account_id,
  });

  if (error) {
    console.error("[bank-imports confirm rpc]", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const result = (data ?? {}) as RpcResult;
  if (!result.ok) {
    const status = result.code === 404 ? 404 : 409;
    return NextResponse.json({ error: result.error ?? "Conflict", details: result }, { status });
  }

  const importRow = result.import!;
  const importedCount = result.imported_count ?? 0;

  /* ── 2. Reconciliation rescan AFTER successful confirm.

        The atomic transaction has committed; the new cash movements
        are visible. Re-running planCandidates here is idempotent and
        the worst-case failure (rescan error) is non-fatal — operator
        can rescan from the queue. We deliberately do NOT include
        rescan inside the PG function because the engine is JS-side. */
  let newCandidateCount = 0;
  try {
    const now = new Date().toISOString();
    const sinceIso = new Date(Date.now() - 180 * 86_400_000).toISOString().slice(0, 10);
    const [movRes, payRes, existing] = await Promise.all([
      supabaseServer
        .from("finance_cash_movements")
        .select("*")
        .eq("tenant_id", auth.tenant_id)
        .gte("movement_date", sinceIso)
        .in("reconciliation_status", ["unreconciled", "matched", "partially_matched"])
        .limit(500),
      supabaseServer
        .from("finance_payments")
        .select("*")
        .eq("tenant_id", auth.tenant_id)
        .gte("payment_date", sinceIso)
        .not("status", "in", "(cancelled,bounced)")
        .limit(500),
      /* Phase S.4 — only fetch ACTIVE candidates for the skip set.
         Loading every historical row just to throw the rejected /
         expired ones away was the largest unbounded scan in the
         audit. (tenant_id, status, …) indexes turn this into a range
         scan. */
      supabaseServer
        .from("finance_reconciliation_candidates")
        .select("payment_id, cash_movement_id, status, rejected_at")
        .eq("tenant_id", auth.tenant_id)
        .in("status", ["suggested", "confirmed"]),
    ]);
    const movements = (movRes.data ?? []) as CashMovement[];
    const payments = (payRes.data ?? []) as FinancePayment[];

    const skipPairs = new Set<string>();
    for (const c of existing.data ?? []) {
      const key = `${c.payment_id}::${c.cash_movement_id}`;
      if (c.status === "suggested" || c.status === "confirmed") {
        skipPairs.add(key);
      }
    }

    const planned = planCandidates({
      movements,
      payments,
      excludeActivePairs: skipPairs,
    });

    if (planned.length) {
      const insertRows = planned.map((p) => ({
        tenant_id: auth.tenant_id,
        payment_id: p.payment_id,
        cash_movement_id: p.cash_movement_id,
        confidence: p.confidence,
        confidence_level: p.confidence_level,
        candidate_type: p.candidate_type,
        match_reason_summary: p.match_reason_summary,
        matched_factors: p.matched_factors,
        warnings: p.warnings,
        metadata: { ...p.metadata, bank_import_id: importRow.id },
        status: "suggested" as const,
        suggested_at: now,
      }));
      const { data: candData } = await supabaseServer
        .from("finance_reconciliation_candidates")
        .insert(insertRows)
        .select("id");
      newCandidateCount = (candData ?? []).length;
    }
  } catch (e) {
    /* Rescan failure is non-fatal — the operator can rescan manually
       from the reconciliation queue. */
    console.error("[bank-imports confirm rescan]", e instanceof Error ? e.message : String(e));
  }

  return NextResponse.json({
    import: importRow,
    summary: {
      imported_count: importedCount,
      duplicate_count: importRow.duplicate_count,
      error_count: importRow.error_count,
      new_reconciliation_candidates: newCandidateCount,
    },
  });
}
