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
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth, requireModuleAccess } from "@/lib/server/auth";
import type { BankStatementImport, BankStatementFileType } from "@/lib/finance/types";

const ALLOWED_FILE_TYPES: BankStatementFileType[] = ["csv", "xlsx"];
const MAX_BYTES = 10 * 1024 * 1024; // 10MB

export async function GET() {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAccess(auth, "Finance");
  if (deny) return deny;

  const { data, error } = await supabaseServer
    .from("finance_bank_statement_imports")
    .select("*")
    .eq("tenant_id", auth.tenant_id)
    .order("uploaded_at", { ascending: false })
    .limit(50);
  if (error) {
    console.error("[bank-imports GET]", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ imports: (data ?? []) as BankStatementImport[] });
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
  const deny = await requireModuleAccess(auth, "Finance");
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
    .select("id, tenant_id")
    .eq("id", bankAccountId)
    .maybeSingle();
  if (!account || (account as { tenant_id: string }).tenant_id !== auth.tenant_id) {
    return NextResponse.json({ error: "Bank account not found" }, { status: 404 });
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

  const arrayBuf = await file.arrayBuffer();
  const buf = Buffer.from(arrayBuf);
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
