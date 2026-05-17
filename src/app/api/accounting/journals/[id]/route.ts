import "server-only";

/* ===========================================================================
   GET    /api/accounting/journals/[id]       fetch entry + lines
   POST   /api/accounting/journals/[id]/void  void via reversing entry
   ========================================================================== */

import { NextResponse } from "next/server";
import { requireAuth, requireModuleAccess } from "@/lib/server/auth";
import { supabaseServer } from "@/lib/server/supabase-server";
import type { JournalEntry, JournalLine } from "@/lib/accounting/types";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAccess(auth, "Finance");
  if (deny) return deny;

  const { id } = await ctx.params;

  const [entryRes, linesRes] = await Promise.all([
    supabaseServer
      .from("accounting_journal_entries")
      .select("*")
      .eq("id", id)
      .eq("tenant_id", auth.tenant_id)
      .maybeSingle(),
    supabaseServer
      .from("accounting_journal_lines")
      .select("*, account:account_id(id, code, name, type, normal_balance)")
      .eq("entry_id", id)
      .eq("tenant_id", auth.tenant_id)
      .order("line_index"),
  ]);
  if (!entryRes.data) return NextResponse.json({ error: "Entry not found" }, { status: 404 });
  return NextResponse.json({
    entry: entryRes.data as JournalEntry,
    lines: (linesRes.data ?? []) as JournalLine[],
  });
}
