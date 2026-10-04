import "server-only";

/* ===========================================================================
   Accounting periods — the lock date and the period close.

   GET    → { locked_through, locked_at, locked_by, closings: [...] }
   POST   { through: "YYYY-MM-DD" }
          closes the books through that date: every revenue and expense
          balance is moved to Retained Earnings in one posted entry
          (source_type 'closing'), then nothing can be posted on or before
          the date. Finance "edit". Refused while draft entries sit inside
          the period.
   DELETE { through: "YYYY-MM-DD" | null }
          moves the lock back (or removes it). Super Admin only. The closing
          entries stay in the books — void them from the journal if the
          period is genuinely reopened for correction.
   ========================================================================== */

import { NextResponse } from "next/server";
import { requireAuth, requireModuleAccess, requireModuleAction } from "@/lib/server/auth";
import { supabaseServer } from "@/lib/server/supabase-server";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export async function GET() {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAccess(auth, "Finance");
  if (deny) return deny;

  const [{ data: lock }, { data: closings }] = await Promise.all([
    supabaseServer.from("accounting_period_locks").select("locked_through, locked_at, locked_by, note").eq("tenant_id", auth.tenant_id).maybeSingle(),
    supabaseServer
      .from("accounting_journal_entries")
      .select("id, journal_no, entry_date, status, description, posted_at, metadata")
      .eq("tenant_id", auth.tenant_id)
      .eq("source_type", "closing")
      .order("entry_date", { ascending: false })
      .limit(24),
  ]);
  return NextResponse.json({
    locked_through: (lock as { locked_through?: string } | null)?.locked_through ?? null,
    locked_at: (lock as { locked_at?: string } | null)?.locked_at ?? null,
    locked_by: (lock as { locked_by?: string } | null)?.locked_by ?? null,
    closings: closings ?? [],
  });
}

export async function POST(req: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAction(auth, "Finance", "edit");
  if (deny) return deny;

  const body = (await req.json().catch(() => null)) as { through?: unknown } | null;
  const through = typeof body?.through === "string" && DATE_RE.test(body.through) ? body.through : null;
  if (!through) return NextResponse.json({ error: "through must be YYYY-MM-DD" }, { status: 400 });
  if (through > new Date().toISOString().slice(0, 10)) {
    return NextResponse.json({ error: "A period cannot be closed before it has ended" }, { status: 400 });
  }

  const { data, error } = await supabaseServer.rpc("fn_accounting_close_period", {
    p_tenant_id: auth.tenant_id, p_through: through, p_by: auth.account_id,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const r = (data ?? {}) as { ok?: boolean; error?: string; code?: number };
  if (!r.ok) return NextResponse.json({ error: r.error ?? "Close failed" }, { status: r.code ?? 500 });
  return NextResponse.json(r);
}

export async function DELETE(req: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAction(auth, "Finance", "edit");
  if (deny) return deny;
  if (!auth.is_super_admin) return NextResponse.json({ error: "Only a Super Admin can reopen a closed period" }, { status: 403 });

  const body = (await req.json().catch(() => null)) as { through?: unknown } | null;
  const through = typeof body?.through === "string" && DATE_RE.test(body.through) ? body.through : null;
  const { error } = through
    ? await supabaseServer.from("accounting_period_locks").upsert({ tenant_id: auth.tenant_id, locked_through: through, locked_by: auth.account_id, locked_at: new Date().toISOString(), note: "reopened" }, { onConflict: "tenant_id" })
    : await supabaseServer.from("accounting_period_locks").delete().eq("tenant_id", auth.tenant_id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, locked_through: through });
}
