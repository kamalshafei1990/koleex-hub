import "server-only";

/* ===========================================================================
   /api/finance/bank-imports

   GET  — list imports for the tenant (newest first)
   POST — create a new import row + upload the file to finance-documents

   Both routes are tenant-scoped and Finance-module gated. The POST
   handler accepts multipart/form-data so the browser can upload the
   file in one shot; the server hashes the file path under
     {tenant_id}/bank-statements/{import_id}/{original_filename}
   and writes the row + the storage object atomically (best-effort
   compensating delete on storage failure).
   ========================================================================== */

import { NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth, requireModuleAccess , requireModuleAction} from "@/lib/server/auth";
import type { BankStatementImport, BankStatementFileType } from "@/lib/finance/types";

const DUP_WINDOW_DAYS = 30;

const ALLOWED_FILE_TYPES: BankStatementFileType[] = ["csv", "xlsx"];
const MAX_BYTES = 10 * 1024 * 1024; // 10MB

export async function GET() {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAccess(auth, "Finance");
  if (deny) return deny;

  /* Phase S.4 — list-payload bound. The list endpoint NEVER returns
     `metadata` (parser detected_mapping + headers + parse_warnings —
     can be tens of KB per row on wide CSVs). Detail endpoint fetches
     full row when expanded. Stamp metadata: {} so the client type
     stays satisfied. */
  const { data, error } = await supabaseServer
    .from("finance_bank_statement_imports")
    .select(
      "id, tenant_id, bank_account_id, file_name, file_type, file_size, file_hash, " +
      "storage_path, status, row_count, imported_count, duplicate_count, error_count, " +
      "uploaded_by, uploaded_at, confirmed_by, confirmed_at, notes, created_at, updated_at",
    )
    .eq("tenant_id", auth.tenant_id)
    .order("uploaded_at", { ascending: false })
    .limit(50);
  if (error) {
    console.error("[bank-imports GET]", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  const imports = (data ?? []).map((r) => ({ ...(r as unknown as Record<string, unknown>), metadata: {} })) as unknown as BankStatementImport[];
  return NextResponse.json({ imports });
}

function inferFileType(name: string, mime: string | undefined): BankStatementFileType | null {
  const lower = name.toLowerCase();
  if (lower.endsWith(".csv")) return "csv";
  if (lower.endsWith(".xlsx") || lower.endsWith(".xlsm")) return "xlsx";
  if (mime?.includes("csv")) return "csv";
  if (mime?.includes("sheet")) return "xlsx";
  return null;
}

export async function POST(req: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAction(auth, "Finance", "create");
  if (deny) return deny;

  const form = await req.formData();
  const file = form.get("file");
  const bankAccountId = form.get("bank_account_id");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "file is required" }, { status: 400 });
  }
  if (typeof bankAccountId !== "string" || !bankAccountId) {
    return NextResponse.json({ error: "bank_account_id is required" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: `File too large (max ${MAX_BYTES / 1024 / 1024} MB)` }, { status: 413 });
  }
  const fileType = inferFileType(file.name, file.type);
  if (!fileType || !ALLOWED_FILE_TYPES.includes(fileType)) {
    return NextResponse.json({ error: "Only CSV or XLSX files are supported" }, { status: 415 });
  }

  /* Verify the bank account exists in this tenant. */
  const { data: account } = await supabaseServer
    .from("finance_bank_accounts")
    .select("id, tenant_id, status")
    .eq("id", bankAccountId)
    .eq("tenant_id", auth.tenant_id)
    .maybeSingle();
  if (!account) {
    return NextResponse.json({ error: "Bank account not found" }, { status: 404 });
  }
  if ((account as { status: string }).status !== "active") {
    return NextResponse.json(
      { error: `Cannot import into a ${account.status} bank account` },
      { status: 409 },
    );
  }

  /* Phase S.3 — compute sha256 of the file bytes BEFORE inserting the
     import row. The hash is used for:
       · the duplicate-upload guard (below)
       · replay detection across the rolling 30-day window
       · provenance (this CSV is byte-identical to import X). */
  const arrayBuf = await file.arrayBuffer();
  const buf = Buffer.from(arrayBuf);
  const fileHash = createHash("sha256").update(buf).digest("hex");

  /* Duplicate guard. We reject re-uploads of an identical file in
     the active set (uploaded | parsed | confirmed) within 30 days.
     Cancelled / failed imports do NOT block; operator may retry. */
  const sinceIso = new Date(Date.now() - DUP_WINDOW_DAYS * 86_400_000).toISOString();
  const { data: dups } = await supabaseServer
    .from("finance_bank_statement_imports")
    .select("id, status, uploaded_at, file_name")
    .eq("tenant_id", auth.tenant_id)
    .eq("file_hash", fileHash)
    .in("status", ["uploaded", "parsed", "confirmed"])
    .gte("uploaded_at", sinceIso)
    .order("uploaded_at", { ascending: false })
    .limit(1);
  if (dups && dups.length > 0) {
    const existing = dups[0] as { id: string; status: string; uploaded_at: string; file_name: string };
    return NextResponse.json(
      {
        error: "duplicate_upload",
        details:
          `An identical file was uploaded ${Math.round((Date.now() - new Date(existing.uploaded_at).getTime()) / 86_400_000)}d ago (import ${existing.id.slice(0, 8)}, status ${existing.status}). Cancel that import first if you want to re-process.`,
        existing_import_id: existing.id,
        existing_status: existing.status,
        existing_uploaded_at: existing.uploaded_at,
      },
      { status: 409 },
    );
  }

  /* Create the row first so we have the import_id for the storage path. */
  const { data: importRow, error: insertErr } = await supabaseServer
    .from("finance_bank_statement_imports")
    .insert({
      tenant_id: auth.tenant_id,
      bank_account_id: bankAccountId,
      file_name: file.name,
      file_type: fileType,
      file_size: file.size,
      file_hash: fileHash,
      status: "uploaded",
      uploaded_by: auth.account_id,
      metadata: {},
    })
    .select("*")
    .single();
  if (insertErr || !importRow) {
    console.error("[bank-imports POST insert]", insertErr?.message);
    return NextResponse.json({ error: insertErr?.message ?? "Insert failed" }, { status: 500 });
  }

  /* Storage path under the tenant-scoped bank-statements folder. */
  const safeName = file.name.replace(/[^A-Za-z0-9._-]+/g, "_");
  const storagePath = `${auth.tenant_id}/bank-statements/${importRow.id}/${safeName}`;

  const { error: storageErr } = await supabaseServer.storage
    .from("finance-documents")
    .upload(storagePath, buf, {
      contentType: file.type || (fileType === "csv" ? "text/csv" : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"),
      upsert: false,
    });
  if (storageErr) {
    console.error("[bank-imports POST storage]", storageErr.message);
    /* Compensating delete on the import row. Tenant filter is defence
       in depth: importRow was just created by us with auth.tenant_id,
       but never let writes drop the filter. */
    await supabaseServer
      .from("finance_bank_statement_imports")
      .delete()
      .eq("id", importRow.id)
      .eq("tenant_id", auth.tenant_id);
    return NextResponse.json({ error: storageErr.message }, { status: 500 });
  }

  const { data: updated, error: updateErr } = await supabaseServer
    .from("finance_bank_statement_imports")
    .update({ storage_path: storagePath })
    .eq("id", importRow.id)
    .eq("tenant_id", auth.tenant_id)
    .select("*")
    .single();
  if (updateErr) {
    console.error("[bank-imports POST update]", updateErr.message);
    return NextResponse.json({ error: updateErr.message }, { status: 500 });
  }

  return NextResponse.json({ import: updated as BankStatementImport });
}
