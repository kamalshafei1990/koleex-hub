import "server-only";

/* DELETE /api/finance/setup/assets/:id
   Soft-archives the asset and reverses its capitalisation entry, so the
   balance sheet and the register agree. Depreciation already booked stays
   in the months it belongs to; the archive stops future runs. */

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

  const { data: entry } = await supabaseServer
    .from("accounting_journal_entries")
    .select("id")
    .eq("tenant_id", auth.tenant_id)
    .eq("source_type", "opening_balance")
    .eq("source_id", id)
    .eq("status", "posted")
    .maybeSingle();
  if (entry?.id) {
    const v = await voidJournalEntry({ tenantId: auth.tenant_id, postedByAccountId: auth.account_id }, (entry as { id: string }).id, "Asset archived");
    if (!v.ok) return NextResponse.json({ error: v.error }, { status: v.code ?? 409 });
  }

  const { error } = await supabaseServer
    .from("finance_assets")
    .update({ status: "archived" })
    .eq("id", id)
    .eq("tenant_id", auth.tenant_id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
