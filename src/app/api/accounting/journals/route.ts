import "server-only";

/* ===========================================================================
   GET  /api/accounting/journals         list recent journal entries
   POST /api/accounting/journals         create + post a manual entry

   The POST handler exists for manual adjusting entries — the
   posting engine (postPayment, postExpense, …) is the path for
   operationally-derived entries. Both paths use the same
   atomic post RPC under the hood.
   ========================================================================== */

import { NextResponse } from "next/server";
import { requireAuth, requireModuleAccess } from "@/lib/server/auth";
import { supabaseServer } from "@/lib/server/supabase-server";
import { resolveBaseCurrency } from "@/lib/finance/currency";
import type { JournalEntry, JournalLine } from "@/lib/accounting/types";

interface ManualLineBody {
  account_id: string;
  debit?: number;
  credit?: number;
  currency?: string;
  description?: string | null;
  party_id?: string | null;
  party_type?: "customer" | "supplier" | null;
  reference?: string | null;
}

interface ManualEntryBody {
  entry_date?: string;
  description?: string;
  lines: ManualLineBody[];
  metadata?: Record<string, unknown>;
}

export async function GET(req: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAccess(auth, "Finance");
  if (deny) return deny;

  const url = new URL(req.url);
  const reqLimit = Number(url.searchParams.get("limit"));
  const limit = Number.isFinite(reqLimit) && reqLimit > 0 ? Math.min(reqLimit, 500) : 100;
  const status = url.searchParams.get("status");

  let q = supabaseServer
    .from("accounting_journal_entries")
    .select("*")
    .eq("tenant_id", auth.tenant_id)
    .order("entry_date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(limit);
  if (status) q = q.eq("status", status);

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ entries: (data ?? []) as JournalEntry[] });
}

export async function POST(req: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAccess(auth, "Finance");
  if (deny) return deny;

  const body = (await req.json().catch(() => null)) as ManualEntryBody | null;
  if (!body?.lines || body.lines.length < 2) {
    return NextResponse.json({ error: "lines[] with at least two entries required" }, { status: 400 });
  }

  /* Pre-flight balance check — the RPC also enforces this. */
  const debitSum  = body.lines.reduce((s, l) => s + (Number(l.debit)  || 0), 0);
  const creditSum = body.lines.reduce((s, l) => s + (Number(l.credit) || 0), 0);
  if (Math.abs(debitSum - creditSum) > 0.005) {
    return NextResponse.json({ error: `Unbalanced: debit ${debitSum.toFixed(2)} vs credit ${creditSum.toFixed(2)}` }, { status: 422 });
  }

  const entryDate = body.entry_date ?? new Date().toISOString().slice(0, 10);
  const journalNo = `JE-MAN-${entryDate.replace(/-/g, "")}-${Date.now().toString(16).slice(-6).toUpperCase()}`;

  const { data: header, error: headerErr } = await supabaseServer
    .from("accounting_journal_entries")
    .insert({
      tenant_id: auth.tenant_id,
      journal_no: journalNo,
      entry_date: entryDate,
      source_type: "manual",
      status: "draft",
      description: body.description ?? "Manual journal",
      created_by: auth.account_id,
      metadata: body.metadata ?? {},
    })
    .select("id")
    .single();
  if (headerErr || !header) {
    return NextResponse.json({ error: headerErr?.message ?? "Insert failed" }, { status: 500 });
  }
  const entryId = (header as { id: string }).id;

  /* Currency stabilization — journal lines default to the tenant's base
     currency when the line omits one (the journal is internal to the GL
     and posts in base currency unless explicitly overridden). */
  const journalBaseCcy = await resolveBaseCurrency(auth.tenant_id);
  const lineRows = body.lines.map((l, i) => ({
    tenant_id: auth.tenant_id,
    entry_id: entryId,
    line_index: i,
    account_id: l.account_id,
    debit:  Number(l.debit)  || 0,
    credit: Number(l.credit) || 0,
    currency: l.currency ?? journalBaseCcy,
    exchange_rate: 1,
    description: l.description ?? null,
    party_id:   l.party_id   ?? null,
    party_type: l.party_type ?? null,
    reference:  l.reference  ?? null,
  }));
  const { error: linesErr } = await supabaseServer
    .from("accounting_journal_lines")
    .insert(lineRows);
  if (linesErr) {
    await supabaseServer.from("accounting_journal_entries").delete().eq("id", entryId).eq("tenant_id", auth.tenant_id);
    return NextResponse.json({ error: linesErr.message }, { status: 500 });
  }

  const { data: postRes, error: postErr } = await supabaseServer.rpc("fn_accounting_post_entry", {
    p_entry_id: entryId,
    p_tenant_id: auth.tenant_id,
    p_posted_by: auth.account_id,
  });
  if (postErr) return NextResponse.json({ error: postErr.message }, { status: 500 });
  const r = (postRes ?? {}) as { ok?: boolean; error?: string; code?: number };
  if (!r.ok) {
    /* Cleanup — entry stays in draft for the operator to inspect. */
    return NextResponse.json({ error: r.error ?? "Post failed" }, { status: r.code ?? 409 });
  }

  /* Return the full posted entry + lines. */
  const [headerRow, linesData] = await Promise.all([
    supabaseServer.from("accounting_journal_entries").select("*").eq("id", entryId).maybeSingle(),
    supabaseServer.from("accounting_journal_lines").select("*").eq("entry_id", entryId).order("line_index"),
  ]);
  return NextResponse.json({
    entry: headerRow.data as JournalEntry,
    lines: (linesData.data ?? []) as JournalLine[],
  });
}
