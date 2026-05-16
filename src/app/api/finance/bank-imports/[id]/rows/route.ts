import "server-only";

/* ===========================================================================
   PATCH /api/finance/bank-imports/[id]/rows

   Bulk-edit parsed rows before confirm — operator may toggle individual
   rows between ready/skipped, override duplicate flag, or fix the
   classified fields (amount, date, reference, direction, …) without
   having to re-upload the file.

   Body:
     updates: Array<{ id, fields }>

   `fields` may carry any subset of:
     import_status, duplicate_status,
     movement_date, value_date, description, reference, counterparty_name,
     direction, amount, currency, balance_after, movement_type, error_message
   ========================================================================== */

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth, requireModuleAccess } from "@/lib/server/auth";
import type { BankStatementRow } from "@/lib/finance/types";

interface RowUpdate {
  id: string;
  fields: Partial<BankStatementRow>;
}

const ALLOWED_FIELDS: Array<keyof BankStatementRow> = [
  "import_status",
  "duplicate_status",
  "movement_date",
  "value_date",
  "description",
  "reference",
  "counterparty_name",
  "direction",
  "amount",
  "currency",
  "balance_after",
  "movement_type",
  "error_message",
];

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAccess(auth, "Finance");
  if (deny) return deny;
  const { id } = await ctx.params;

  const body = (await req.json().catch(() => null)) as { updates?: RowUpdate[] } | null;
  if (!body?.updates?.length) {
    return NextResponse.json({ error: "updates[] required" }, { status: 400 });
  }

  /* Tenant scope verification. */
  const { data: importRow } = await supabaseServer
    .from("finance_bank_statement_imports")
    .select("id, tenant_id, status")
    .eq("id", id)
    .eq("tenant_id", auth.tenant_id)
    .maybeSingle();
  if (!importRow) return NextResponse.json({ error: "Import not found" }, { status: 404 });
  if ((importRow as { status: string }).status === "confirmed") {
    return NextResponse.json({ error: "Cannot edit rows after confirm" }, { status: 409 });
  }

  /* Per-row update — small batch in practice (≤ a few hundred). */
  const results: BankStatementRow[] = [];
  for (const u of body.updates) {
    const patch: Partial<BankStatementRow> = {};
    for (const k of ALLOWED_FIELDS) {
      if (k in u.fields) {
        (patch as Record<string, unknown>)[k] = u.fields[k] as unknown;
      }
    }
    if (Object.keys(patch).length === 0) continue;
    const { data, error } = await supabaseServer
      .from("finance_bank_statement_rows")
      .update(patch)
      .eq("id", u.id)
      .eq("import_id", id)
      .eq("tenant_id", auth.tenant_id)
      .select("*")
      .maybeSingle();
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    if (data) results.push(data as BankStatementRow);
  }

  return NextResponse.json({ rows: results });
}
