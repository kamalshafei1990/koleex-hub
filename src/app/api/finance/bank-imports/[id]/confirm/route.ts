import "server-only";

/* ===========================================================================
   POST /api/finance/bank-imports/[id]/confirm

   Materialises every parsed row with import_status='ready' as a
   finance_cash_movements record. Skipped rows (duplicate / operator-
   excluded) and error rows are kept in the audit table but never
   become movements.

   After insert, the route triggers an internal reconciliation rescan
   so the new movements immediately enter the auto-match pipeline. No
   match is ever confirmed automatically — that stays with the
   operator in the /finance/reconciliation queue.
   ========================================================================== */

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth, requireModuleAccess } from "@/lib/server/auth";
import type {
  BankStatementImport,
  BankStatementRow,
  CashMovement,
  FinancePayment,
} from "@/lib/finance/types";
import { planCandidates } from "@/lib/finance/reconciliation-engine";

export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAccess(auth, "Finance");
  if (deny) return deny;
  const { id } = await ctx.params;

  /* Load import + rows. */
  const [impRes, rowsRes] = await Promise.all([
    supabaseServer
      .from("finance_bank_statement_imports")
      .select("*")
      .eq("id", id)
      .eq("tenant_id", auth.tenant_id)
      .maybeSingle(),
    supabaseServer
      .from("finance_bank_statement_rows")
      .select("*")
      .eq("import_id", id)
      .eq("tenant_id", auth.tenant_id)
      .eq("import_status", "ready"),
  ]);
  if (!impRes.data) return NextResponse.json({ error: "Import not found" }, { status: 404 });
  const importRow = impRes.data as BankStatementImport;
  if (importRow.status === "confirmed") {
    return NextResponse.json({ error: "Already confirmed" }, { status: 409 });
  }
  if (importRow.status !== "parsed") {
    return NextResponse.json({ error: `Cannot confirm: status is ${importRow.status}` }, { status: 409 });
  }
  const rows = (rowsRes.data ?? []) as BankStatementRow[];

  const now = new Date().toISOString();
  const movementInserts = rows
    .filter((r) => r.movement_date && r.amount != null && r.direction)
    .map((r) => ({
      tenant_id: auth.tenant_id,
      bank_account_id: r.bank_account_id,
      related_payment_id: null,
      movement_type: r.movement_type ?? (r.direction === "inflow" ? "incoming" : "outgoing"),
      direction: r.direction,
      currency: r.currency ?? "USD",
      amount: r.amount,
      exchange_rate: null,
      reporting_amount: null,
      bank_reference: r.reference,
      external_reference: null,
      counterparty_name: r.counterparty_name,
      movement_date: r.movement_date,
      cleared_at: null,
      reconciliation_status: "unreconciled" as const,
      evidence_status: importRow.storage_path ? ("pending" as const) : ("missing" as const),
      notes: r.description,
      metadata: {
        bank_import_id: importRow.id,
        bank_import_row_id: r.id,
        bank_import_storage_path: importRow.storage_path,
      },
      created_by: auth.account_id,
    }));

  let importedCount = 0;
  let createdMovements: CashMovement[] = [];

  if (movementInserts.length) {
    const { data: inserted, error: movErr } = await supabaseServer
      .from("finance_cash_movements")
      .insert(movementInserts)
      .select("*");
    if (movErr) {
      console.error("[bank-imports confirm movements]", movErr.message);
      return NextResponse.json({ error: movErr.message }, { status: 500 });
    }
    createdMovements = (inserted ?? []) as CashMovement[];
    importedCount = createdMovements.length;

    /* Pair each created movement back to its source row so the audit
       trail is bidirectional. */
    for (let i = 0; i < createdMovements.length; i += 1) {
      const movement = createdMovements[i];
      const sourceRow = rows[i];
      if (!sourceRow) continue;
      await supabaseServer
        .from("finance_bank_statement_rows")
        .update({
          import_status: "imported",
          matched_cash_movement_id: movement.id,
        })
        .eq("id", sourceRow.id)
        .eq("tenant_id", auth.tenant_id);
    }
  }

  /* Mark the import confirmed. */
  const { data: updated } = await supabaseServer
    .from("finance_bank_statement_imports")
    .update({
      status: "confirmed",
      confirmed_at: now,
      confirmed_by: auth.account_id,
      imported_count: importedCount,
    })
    .eq("id", importRow.id)
    .eq("tenant_id", auth.tenant_id)
    .select("*")
    .single();

  /* Trigger reconciliation rescan inline. We re-use planCandidates()
     directly instead of fetching /api/finance/reconciliation/rescan to
     avoid an internal HTTP round-trip; the side effects are identical. */
  let newCandidateCount = 0;
  try {
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
      supabaseServer
        .from("finance_reconciliation_candidates")
        .select("payment_id, cash_movement_id, status, rejected_at")
        .eq("tenant_id", auth.tenant_id),
    ]);
    const movements = (movRes.data ?? []) as CashMovement[];
    const payments = (payRes.data ?? []) as FinancePayment[];

    /* Skip pairs that already exist or were rejected without new data. */
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
    import: updated as BankStatementImport,
    summary: {
      imported_count: importedCount,
      duplicate_count: importRow.duplicate_count,
      error_count: importRow.error_count,
      new_reconciliation_candidates: newCandidateCount,
    },
  });
}
