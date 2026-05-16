import "server-only";

/* ===========================================================================
   POST /api/finance/bank-accounts/[id]/archive

   Soft-deactivates a bank account. Never destructive:

     · status='archived' for accounts with movements
     · status='closed'   when the operator explicitly chose to close
     · status='frozen'   for temporary holds

   Hard deletion is intentionally not exposed via the API. If an account
   has any cash movements, only soft deactivation is allowed.
   ========================================================================== */

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth, requireModuleAccess } from "@/lib/server/auth";
import type { BankAccount, BankAccountStatus } from "@/lib/finance/types";

interface Body {
  status?: BankAccountStatus;
  notes?: string;
}

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAccess(auth, "Finance");
  if (deny) return deny;
  const { id } = await ctx.params;

  const body = (await req.json().catch(() => ({}))) as Body;
  const nextStatus: BankAccountStatus =
    body.status ?? "archived";
  if (!["archived", "closed", "frozen"].includes(nextStatus)) {
    return NextResponse.json({ error: "Invalid target status" }, { status: 400 });
  }

  /* Existence + tenant scope. */
  const { data: existing } = await supabaseServer
    .from("finance_bank_accounts")
    .select("*")
    .eq("id", id)
    .eq("tenant_id", auth.tenant_id)
    .maybeSingle();
  if (!existing) return NextResponse.json({ error: "Account not found" }, { status: 404 });

  const md = { ...((existing as BankAccount).metadata ?? {}) };
  if (body.notes) (md as Record<string, unknown>).archive_note = body.notes;

  const { data, error } = await supabaseServer
    .from("finance_bank_accounts")
    .update({
      status: nextStatus,
      is_primary: false,
      metadata: md,
    })
    .eq("id", id)
    .eq("tenant_id", auth.tenant_id)
    .select("*")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ account: data as BankAccount });
}
