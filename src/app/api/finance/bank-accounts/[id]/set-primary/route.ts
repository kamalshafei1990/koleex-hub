import "server-only";

/* ===========================================================================
   POST /api/finance/bank-accounts/[id]/set-primary

   Promotes an account to primary for its currency. Demotes any prior
   primary in the same currency. The "one primary per currency"
   invariant is enforced in the application layer because the DB
   schema doesn't carry a partial unique index for it.
   ========================================================================== */

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth, requireModuleAccess , requireModuleAction} from "@/lib/server/auth";
import type { BankAccount } from "@/lib/finance/types";

export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAction(auth, "Finance", "edit");
  if (deny) return deny;
  const { id } = await ctx.params;

  const { data: existing } = await supabaseServer
    .from("finance_bank_accounts")
    .select("*")
    .eq("id", id)
    .eq("tenant_id", auth.tenant_id)
    .maybeSingle();
  if (!existing) return NextResponse.json({ error: "Account not found" }, { status: 404 });
  const account = existing as BankAccount;
  if (account.status !== "active") {
    return NextResponse.json({ error: "Only active accounts can be made primary" }, { status: 409 });
  }

  /* Demote any current primary in the same currency. */
  await supabaseServer
    .from("finance_bank_accounts")
    .update({ is_primary: false })
    .eq("tenant_id", auth.tenant_id)
    .eq("currency", account.currency)
    .eq("is_primary", true)
    .neq("id", id);

  const { data, error } = await supabaseServer
    .from("finance_bank_accounts")
    .update({ is_primary: true })
    .eq("id", id)
    .eq("tenant_id", auth.tenant_id)
    .select("*")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ account: data as BankAccount });
}
