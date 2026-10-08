import "server-only";

/* ===========================================================================
   GET  /api/accounting/journals?status=&limit=&offset=&from=&to=&q=
        recent journal entries, newest first
   POST /api/accounting/journals
        a manual adjusting entry — the posting engine validates the
        accounts (this tenant, active), one side per line, the period lock
        and the balance in base currency, numbers it from the tenant's
        sequence and posts it in one step. `post: false` leaves it as a
        draft for the queue.
   ========================================================================== */

import { NextResponse } from "next/server";
import { requireAuth, requireModuleAccess, requireModuleAction } from "@/lib/server/auth";
import { supabaseServer } from "@/lib/server/supabase-server";
import { postManualJournal, type ManualLine } from "@/lib/accounting/posting";
import type { JournalEntry } from "@/lib/accounting/types";

export async function GET(req: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAccess(auth, "Finance");
  if (deny) return deny;

  const url = new URL(req.url);
  const reqLimit = Number(url.searchParams.get("limit"));
  const limit = Number.isFinite(reqLimit) && reqLimit > 0 ? Math.min(reqLimit, 500) : 100;
  const offset = Math.max(Number(url.searchParams.get("offset")) || 0, 0);
  const status = url.searchParams.get("status");
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");
  const q = url.searchParams.get("q")?.trim();

  let query = supabaseServer
    .from("accounting_journal_entries")
    .select("*", { count: "exact" })
    .eq("tenant_id", auth.tenant_id)
    .order("entry_date", { ascending: false })
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);
  if (status) query = query.eq("status", status);
  if (from) query = query.gte("entry_date", from);
  if (to) query = query.lte("entry_date", to);
  if (q) query = query.or(`journal_no.ilike.%${q.replace(/[%_,()]/g, "")}%,description.ilike.%${q.replace(/[%_,()]/g, "")}%`);

  const { data, error, count } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ entries: (data ?? []) as JournalEntry[], total: count ?? 0, limit, offset });
}

interface ManualEntryBody {
  entry_date?: string;
  description?: string;
  lines?: ManualLine[];
  metadata?: Record<string, unknown>;
  post?: boolean;
}

export async function POST(req: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAction(auth, "Finance", "edit");
  if (deny) return deny;

  const body = (await req.json().catch(() => null)) as ManualEntryBody | null;
  if (!body?.lines || !Array.isArray(body.lines) || body.lines.length < 2) {
    return NextResponse.json({ error: "lines[] with at least two entries required" }, { status: 400 });
  }
  const res = await postManualJournal(
    { tenantId: auth.tenant_id, postedByAccountId: auth.account_id },
    { entry_date: body.entry_date, description: body.description, lines: body.lines, metadata: body.metadata, post: body.post !== false },
  );
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: res.code ?? 500 });
  return NextResponse.json(res, { status: 201 });
}
