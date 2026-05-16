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
/* Phase S.3 — large-import protection. CSVs / XLSX files with more
   than this many parsable rows are rejected before any row hits the
   DB. Operators can split a multi-month statement into chunks. */
const MAX_PARSED_ROWS = 5_000;

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

  /* Phase S.3 — large-import protection. Reject before any row hits
     the rows table so we never half-import a 50K-row statement that
     would later time out at confirm. */
  const totalParsedCount = parsed.rows.length + parsed.errorRows.length;
  if (totalParsedCount > MAX_PARSED_ROWS) {
    await supabaseServer
      .from("finance_bank_statement_imports")
      .update({
        status: "failed",
        metadata: {
          ...importRow.metadata,
          parse_error: `oversized_import: ${totalParsedCount} rows exceeds ceiling of ${MAX_PARSED_ROWS}`,
          row_count_attempted: totalParsedCount,
        },
      })
      .eq("id", importRow.id)
      .eq("tenant_id", auth.tenant_id);
    return NextResponse.json(
      {
        error: "oversized_import",
        details: `${totalParsedCount} rows exceeds the ceiling of ${MAX_PARSED_ROWS}. Split the statement into chunks and re-upload.`,
        row_count: totalParsedCount,
        limit: MAX_PARSED_ROWS,
      },
      { status: 413 },
    );
  }

  /* Phase S.3 — empty parse: no parsable rows AND no error rows. Flag
     it explicitly so the operator knows the file wasn't readable
     (wrong delimiter, missing headers, …) — don't silently proceed
     with a "successful" parse that imports nothing. */
  if (totalParsedCount === 0) {
    await supabaseServer
      .from("finance_bank_statement_imports")
      .update({
        status: "failed",
        metadata: {
          ...importRow.metadata,
          parse_error: "empty_parse: 0 rows extracted",
          detected_mapping: parsed.detectedMapping,
          headers: parsed.headers,
        },
      })
      .eq("id", importRow.id)
      .eq("tenant_id", auth.tenant_id);
    return NextResponse.json(
      {
        error: "empty_parse",
        details: "The parser could not extract any rows from the file. Verify the headers, delimiter, and encoding.",
        headers: parsed.headers,
      },
      { status: 422 },
    );
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

  /* Phase S.3 — atomic delete-then-insert via fn_bank_import_replace_rows.
     The wipe + insert + status promotion now happen in one PG
     transaction so a partial failure leaves no orphaned half-rows. */

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

  /* Phase S.3 — atomic replace: delete prior rows + insert new rows +
     promote import.status='parsed' + write metadata in one PG tx.
     A partial-insert failure rolls everything back, so the operator
     never sees a parsed import with mismatched row counts. */
  const rowsForRpc = rowInserts.map((r) => ({
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
    duplicate_status: r.duplicate_status,
    import_status: r.import_status,
    matched_cash_movement_id: r.matched_cash_movement_id,
    error_message: r.error_message,
    metadata: r.metadata,
  }));

  const totalCount = parsed.rows.length + parsed.errorRows.length;
  /* Capture any parser warnings into metadata so the operator can
     trace WHY rows were dropped. Today the parser exposes errorRows
     individually; we surface a top-level summary too. */
  const importMetadata = {
    ...importRow.metadata,
    detected_mapping: parsed.detectedMapping,
    headers: parsed.headers,
    parse_warnings: parsed.errorRows.length > 0 ? {
      count: parsed.errorRows.length,
      first_few: parsed.errorRows.slice(0, 5).map((e) => ({
        row_index: e.row_index,
        message: e.error_message,
      })),
    } : undefined,
  };

  const { data: rpcRes, error: rpcErr } = await supabaseServer.rpc(
    "fn_bank_import_replace_rows",
    {
      p_import_id: importRow.id,
      p_tenant_id: auth.tenant_id,
      p_rows: rowsForRpc,
      p_metadata: importMetadata,
      p_row_count: totalCount,
      p_duplicate_count: duplicateCount,
      p_error_count: errorCount,
    },
  );
  if (rpcErr) {
    console.error("[bank-imports parse rpc]", rpcErr.message);
    return NextResponse.json({ error: rpcErr.message }, { status: 500 });
  }
  const result = (rpcRes ?? {}) as {
    ok?: boolean; error?: string; code?: number; import?: BankStatementImport;
  };
  if (!result.ok) {
    const status = result.code === 404 ? 404 : 409;
    return NextResponse.json({ error: result.error ?? "Conflict" }, { status });
  }

  return NextResponse.json({
    import: result.import as BankStatementImport,
    summary: {
      total: rowInserts.length,
      ready: rowInserts.filter((r) => r.import_status === "ready").length,
      skipped: duplicateCount,
      errors: errorCount,
      mapping: parsed.detectedMapping,
    },
  });
}
