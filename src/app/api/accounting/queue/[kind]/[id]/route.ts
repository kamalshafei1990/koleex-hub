import "server-only";

/* ===========================================================================
   GET /api/accounting/queue/[kind]/[id]

   Returns one queue item with everything the Accounting Review Panel
   needs to render:
     · operational source row (full)
     · the linked journal entry (if any)
     · its lines + joined account info
   `kind` is any SourceKind; the table comes from the posting engine's
   own mapping so a new kind never needs a second list here.
   ========================================================================== */

import { NextResponse } from "next/server";
import { requireAuth, requireModuleAccess } from "@/lib/server/auth";
import { supabaseServer } from "@/lib/server/supabase-server";
import { isSourceKind, sourceTableFor } from "@/lib/accounting/posting";

export async function GET(_req: Request, ctx: { params: Promise<{ kind: string; id: string }> }) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAccess(auth, "Finance");
  if (deny) return deny;

  const { kind, id } = await ctx.params;
  const tbl = isSourceKind(kind) ? sourceTableFor(kind) : null;
  if (!tbl) return NextResponse.json({ error: "Unknown kind" }, { status: 400 });

  /* Payroll runs predate tenant scoping; accept the tenant's or unlabelled rows. */
  let q = supabaseServer.from(tbl).select("*").eq("id", id);
  q = kind === "payroll" ? q.or(`tenant_id.eq.${auth.tenant_id},tenant_id.is.null`) : q.eq("tenant_id", auth.tenant_id);
  const { data: source, error: srcErr } = await q.maybeSingle();
  if (srcErr || !source) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const src = source as { accounting_entry_id: string | null };

  let entry: unknown = null;
  let lines: unknown[] = [];
  if (src.accounting_entry_id) {
    const [entryRes, linesRes] = await Promise.all([
      supabaseServer
        .from("accounting_journal_entries")
        .select("*")
        .eq("id", src.accounting_entry_id)
        .eq("tenant_id", auth.tenant_id)
        .maybeSingle(),
      supabaseServer
        .from("accounting_journal_lines")
        .select("*, account:account_id(id, code, name, type, normal_balance)")
        .eq("entry_id", src.accounting_entry_id)
        .eq("tenant_id", auth.tenant_id)
        .order("line_index"),
    ]);
    entry = entryRes.data ?? null;
    lines = linesRes.data ?? [];
  }

  return NextResponse.json({ source, entry, lines });
}
