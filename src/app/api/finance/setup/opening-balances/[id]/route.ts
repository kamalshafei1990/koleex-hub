import "server-only";

/* DELETE /api/finance/setup/opening-balances/:id
   Removes an opening-balance line. Its journal entry (if it was posted)
   is reversed first so the books and the setup list stay in step; a
   line inside a closed period cannot be removed until it is reopened. */

import { NextResponse } from "next/server";
import { requireAuth, requireModuleAction } from "@/lib/server/auth";
import { supabaseServer } from "@/lib/server/supabase-server";
import { voidJournalEntry } from "@/lib/accounting/posting";

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAction(auth, "Finance", "delete");
  if (deny) return deny;

  const { data: row } = await supabaseServer
    .from("finance_opening_balances")
    .select("id, accounting_entry_id, accounting_status")
    .eq("id", id)
    .eq("tenant_id", auth.tenant_id)
    .maybeSingle();
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const r = row as { accounting_entry_id: string | null; accounting_status: string | null };
  if (r.accounting_entry_id && (r.accounting_status === "posted" || r.accounting_status === "drafted")) {
    const v = await voidJournalEntry({ tenantId: auth.tenant_id, postedByAccountId: auth.account_id }, r.accounting_entry_id, "Opening balance removed");
    if (!v.ok) return NextResponse.json({ error: v.error }, { status: v.code ?? 409 });
  }

  const { error } = await supabaseServer
    .from("finance_opening_balances")
    .delete()
    .eq("id", id)
    .eq("tenant_id", auth.tenant_id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
