import "server-only";

/* ===========================================================================
   POST /api/finance/bank-imports/[id]/parse

   Downloads the stored statement file, runs the deterministic parser,
   classifies each row's duplicate status against existing
   finance_cash_movements, and writes the rows to
   finance_bank_statement_rows. Sets the import status to 'parsed'.

   Idempotent — re-running deletes prior rows for this import first.
   Operator may pass an optional `mapping` body to override the
   auto-detected column mapping.
   ========================================================================== */

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth, requireModuleAccess } from "@/lib/server/auth";
import type {
  BankAccount,
  BankStatementColumnMapping,
  BankStatementImport,
  BankStatementRow,
  CashMovement,
} from "@/lib/finance/types";
import { parseStatement, type ParsedStatementRow } from "@/lib/finance/bank-statement-parser";
import { classifyDuplicate } from "@/lib/finance/bank-statement-duplicates";

interface Body {
  mapping?: BankStatementColumnMapping;
}

const DEDUP_LOOKBACK_DAYS = 120;

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAccess(auth, "Finance");
  if (deny) return deny;
  const { id } = await ctx.params;

  const body = (await req.json().catch(() => ({}))) as Body;

  /* Load the import row + bank account (for default currency). */
  const { data: imp } = await supabaseServer
    .from("finance_bank_statement_imports")
    .select("*")
    .eq("id", id)
    .eq("tenant_id", auth.tenant_id)
    .maybeSingle();
  if (!imp) return NextResponse.json({ error: "Import not found" }, { status: 404 });
  const importRow = imp as BankStatementImport;
  if (!importRow.storage_path) {
    return NextResponse.json({ error: "Import has no file in storage" }, { status: 409 });
  }
  if (importRow.status !== "uploaded" && importRow.status !== "parsed") {
    return NextResponse.json({ error: `Cannot parse: status is ${importRow.status}` }, { status: 409 });
  }

  const { data: acctRow } = await supabaseServer
    .from("finance_bank_accounts")
    .select("*")
    .eq("id", importRow.bank_account_id)
    .eq("tenant_id", auth.tenant_id)
    .maybeSingle();
  const account = acctRow as BankAccount | null;

  /* Download the file from finance-documents bucket. */
  const dl = await supabaseServer.storage
    .from("finance-documents")
    .download(importRow.storage_path);
  if (dl.error || !dl.data) {
    await supabaseServer
      .from("finance_bank_statement_imports")
      .update({ status: "failed", metadata: { ...importRow.metadata, parse_error: dl.error?.message ?? "Download failed" } })
      .eq("id", importRow.id)
      .eq("tenant_id", auth.tenant_id);
    return NextResponse.json({ error: dl.error?.message ?? "Download failed" }, { status: 500 });
  }

  const arrayBuf = await dl.data.arrayBuffer();
  let parsed;
  try {
    parsed = parseStatement({
      fileType: importRow.file_type,
      buffer: arrayBuf,
      defaultCurrency: account?.currency ?? undefined,
      mappingOverride: body.mapping,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await supabaseServer
      .from("finance_bank_statement_imports")
      .update({ status: "failed", metadata: { ...importRow.metadata, parse_error: msg } })
      .eq("id", importRow.id)
      .eq("tenant_id", auth.tenant_id);
    return NextResponse.json({ error: msg }, { status: 422 });
  }

  /* Load recent cash movements in the same account for dedup. */
  const sinceIso = new Date(Date.now() - DEDUP_LOOKBACK_DAYS * 86_400_000).toISOString().slice(0, 10);
  const { data: movRows } = await supabaseServer
    .from("finance_cash_movements")
    .select("*")
    .eq("tenant_id", auth.tenant_id)
    .eq("bank_account_id", importRow.bank_account_id)
    .gte("movement_date", sinceIso)
    .limit(1000);
  const existingMovements = (movRows ?? []) as CashMovement[];

  /* Wipe prior rows for this import (idempotent rescan). */
  await supabaseServer
    .from("finance_bank_statement_rows")
    .delete()
    .eq("import_id", importRow.id)
    .eq("tenant_id", auth.tenant_id);

  let duplicateCount = 0;
  const errorCount = parsed.errorRows.length;

  const rowInserts: Array<Omit<BankStatementRow, "id" | "created_at" | "updated_at" | "matched_cash_movement_id"> & {
    matched_cash_movement_id: string | null;
  }> = parsed.rows.map((r: ParsedStatementRow) => {
    const dup = classifyDuplicate({
      parsedRow: r,
      bankAccountId: importRow.bank_account_id,
      existingMovements,
      siblingRows: parsed.rows,
    });
    if (dup.status === "duplicate") duplicateCount += 1;
    /* Duplicate rows still get inserted but with import_status='skipped'. */
    return {
      tenant_id: auth.tenant_id,
      import_id: importRow.id,
      bank_account_id: importRow.bank_account_id,
      row_index: r.row_index,
      raw_data: r.raw_data,
      movement_date: r.movement_date,
      value_date: r.value_date,
      description: r.description,
      reference: r.reference,
      counterparty_name: r.counterparty_name,
      direction: r.direction,
      amount: r.amount,
      currency: r.currency,
      balance_after: r.balance_after,
      movement_type: r.movement_type,
      duplicate_status: dup.status,
      import_status: dup.status === "duplicate" ? ("skipped" as const) : ("ready" as const),
      matched_cash_movement_id: dup.matchedMovementId,
      error_message: null,
      metadata: { duplicate_reasons: dup.reasons },
    };
  });

  for (const err of parsed.errorRows) {
    rowInserts.push({
      tenant_id: auth.tenant_id,
      import_id: importRow.id,
      bank_account_id: importRow.bank_account_id,
      row_index: err.row_index,
      raw_data: err.raw_data,
      movement_date: null,
      value_date: null,
      description: null,
      reference: null,
      counterparty_name: null,
      direction: null,
      amount: null,
      currency: null,
      balance_after: null,
      movement_type: null,
      duplicate_status: "new",
      import_status: "error",
      matched_cash_movement_id: null,
      error_message: err.error_message,
      metadata: {},
    });
  }

  if (rowInserts.length) {
    const { error: insertErr } = await supabaseServer
      .from("finance_bank_statement_rows")
      .insert(rowInserts);
    if (insertErr) {
      console.error("[bank-imports parse insert]", insertErr.message);
      return NextResponse.json({ error: insertErr.message }, { status: 500 });
    }
  }

  /* Patch the import row. */
  const { data: updated, error: updateErr } = await supabaseServer
    .from("finance_bank_statement_imports")
    .update({
      status: "parsed",
      row_count: parsed.rows.length + parsed.errorRows.length,
      duplicate_count: duplicateCount,
      error_count: errorCount,
      metadata: {
        ...importRow.metadata,
        detected_mapping: parsed.detectedMapping,
        headers: parsed.headers,
      },
    })
    .eq("id", importRow.id)
    .eq("tenant_id", auth.tenant_id)
    .select("*")
    .single();
  if (updateErr) {
    return NextResponse.json({ error: updateErr.message }, { status: 500 });
  }

  return NextResponse.json({
    import: updated as BankStatementImport,
    summary: {
      total: rowInserts.length,
      ready: rowInserts.filter((r) => r.import_status === "ready").length,
      skipped: duplicateCount,
      errors: errorCount,
      mapping: parsed.detectedMapping,
    },
  });
}
