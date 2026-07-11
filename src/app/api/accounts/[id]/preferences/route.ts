import "server-only";

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth } from "@/lib/server/auth";

/* PATCH /api/accounts/[id]/preferences
   Body: { preferences: object }

   Rule: you can always edit your OWN preferences without the Accounts
   permission. Editing someone else's preferences requires SA. */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const editingSelf = id === auth.account_id;
  if (!editingSelf && !auth.is_super_admin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { preferences } = (await req.json()) as {
    preferences: Record<string, unknown>;
  };

  /* Shallow-merge the incoming top-level slices (profile / display /
     notifications / calendar / …) onto whatever is already stored, rather
     than full-replacing. This lets each Settings tab persist only the slice
     it owns and prevents one instant-save tab from clobbering another tab's
     slice with a stale snapshot (the tabs render from a shared account cache
     that only reconciles after an async refetch). */
  const { data: existing } = await supabaseServer
    .from("accounts")
    .select("preferences")
    .eq("id", id)
    .eq("tenant_id", auth.tenant_id)
    .maybeSingle();

  const current = (existing?.preferences ?? {}) as Record<string, unknown>;
  const merged = { ...current, ...(preferences ?? {}) };

  const { error } = await supabaseServer
    .from("accounts")
    .update({ preferences: merged })
    .eq("id", id)
    .eq("tenant_id", auth.tenant_id);
  if (error) {
    console.error("[api/accounts/[id]/preferences]", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
