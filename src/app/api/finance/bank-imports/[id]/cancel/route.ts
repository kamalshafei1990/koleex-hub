import "server-only";

/* ===========================================================================
   POST /api/finance/bank-imports/[id]/cancel

   Marks the import as cancelled. The rows + storage object stay for
   audit; nothing is deleted. A cancelled import never creates cash
   movements.
   ========================================================================== */

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth, requireModuleAccess , requireModuleAction} from "@/lib/server/auth";
import type { BankStatementImport } from "@/lib/finance/types";

export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAction(auth, "Finance", "edit");
  if (deny) return deny;
  const { id } = await ctx.params;

  const { data: existing } = await supabaseServer
    .from("finance_bank_statement_imports")
    .select("id, tenant_id, status")
    .eq("id", id)
    .eq("tenant_id", auth.tenant_id)
    .maybeSingle();
  if (!existing) return NextResponse.json({ error: "Import not found" }, { status: 404 });
  if ((existing as { status: string }).status === "confirmed") {
    return NextResponse.json({ error: "Cannot cancel a confirmed import" }, { status: 409 });
  }

  const { data, error } = await supabaseServer
    .from("finance_bank_statement_imports")
    .update({ status: "cancelled" })
    .eq("id", id)
    .eq("tenant_id", auth.tenant_id)
    .select("*")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ import: data as BankStatementImport });
}
