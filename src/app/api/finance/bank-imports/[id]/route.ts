import "server-only";

/* ===========================================================================
   GET /api/finance/bank-imports/[id]

   Returns the import row + all parsed statement rows so the preview UI
   can render the queue. Tenant-scoped, Finance-module gated.
   ========================================================================== */

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth, requireModuleAccess } from "@/lib/server/auth";
import type { BankStatementImport, BankStatementRow } from "@/lib/finance/types";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAccess(auth, "Finance");
  if (deny) return deny;
  const { id } = await ctx.params;

  const [importRes, rowsRes] = await Promise.all([
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
      .order("row_index", { ascending: true })
      .limit(1000),
  ]);
  if (importRes.error) {
    return NextResponse.json({ error: importRes.error.message }, { status: 500 });
  }
  if (!importRes.data) {
    return NextResponse.json({ error: "Import not found" }, { status: 404 });
  }
  if (rowsRes.error) {
    return NextResponse.json({ error: rowsRes.error.message }, { status: 500 });
  }

  return NextResponse.json({
    import: importRes.data as BankStatementImport,
    rows: (rowsRes.data ?? []) as BankStatementRow[],
  });
}
