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
import { requireAuth, requireModuleAccess , requireModuleAction} from "@/lib/server/auth";
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
  const deny = await requireModuleAction(auth, "Finance", "edit");
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

  /* Phase S.4 — batch update path. In practice the UI fires this PATCH
     when the operator toggles N rows between ready/skipped or applies
     the same correction to a selection. Previously each row in the
     batch incurred a separate round-trip (≤ a few hundred ≈ ≤ several
     hundred ms of cumulative network); now we group by the JSON shape
     of the patch and issue ONE update per shape using .in(id, ids).
     For the common "toggle 50 rows" case that's 1 round-trip instead
     of 50. Per-row error handling is preserved — a failed UPDATE for
     a group bubbles a single error message, same as before. */
  type PatchShape = string; // JSON.stringify of the sanitised patch
  const grouped = new Map<PatchShape, { patch: Partial<BankStatementRow>; ids: string[] }>();
  for (const u of body.updates) {
    const patch: Partial<BankStatementRow> = {};
    for (const k of ALLOWED_FIELDS) {
      if (k in u.fields) {
        (patch as Record<string, unknown>)[k] = u.fields[k] as unknown;
      }
    }
    if (Object.keys(patch).length === 0) continue;
    /* JSON.stringify with sorted keys so {a:1,b:2} and {b:2,a:1}
       collapse to the same group. */
    const key = JSON.stringify(Object.keys(patch).sort().reduce((o, k) => {
      (o as Record<string, unknown>)[k] = (patch as Record<string, unknown>)[k];
      return o;
    }, {} as Partial<BankStatementRow>));
    const slot = grouped.get(key);
    if (slot) slot.ids.push(u.id);
    else grouped.set(key, { patch, ids: [u.id] });
  }

  const results: BankStatementRow[] = [];
  for (const { patch, ids } of grouped.values()) {
    const { data, error } = await supabaseServer
      .from("finance_bank_statement_rows")
      .update(patch)
      .in("id", ids)
      .eq("import_id", id)
      .eq("tenant_id", auth.tenant_id)
      .select("*");
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    for (const r of data ?? []) results.push(r as BankStatementRow);
  }

  return NextResponse.json({ rows: results });
}
