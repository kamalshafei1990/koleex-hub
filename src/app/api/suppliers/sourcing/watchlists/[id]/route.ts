import "server-only";

/* DELETE /api/suppliers/sourcing/watchlists/[id] — remove a saved view / watchlist
   Tenant-scoped, procurement+ only. Hard-delete is allowed here because a
   saved view is user-owned UI state, not auditable supplier data. */

import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth, requireModuleAccess } from "@/lib/server/auth";
import { resolveCallerTier } from "@/lib/suppliers/intelligence";

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAccess(auth, "Suppliers");
  if (deny) return deny;

  const tier = resolveCallerTier(auth);
  if (tier === "public" || tier === "internal") {
    return NextResponse.json({ error: "Insufficient tier" }, { status: 403 });
  }

  const { id } = await params;
  const { error } = await supabaseServer
    .from("sourcing_watchlists")
    .delete()
    .eq("id", id)
    .eq("tenant_id", auth.tenant_id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
