import "server-only";

/* ---------------------------------------------------------------------------
   DELETE /api/suppliers/[id]/timeline/[eventId] — remove a MANUAL event.

   Auto-generated events are immutable audit history and cannot be deleted
   here (is_manual=true guard). Tenant + supplier scoped, Suppliers-module
   gated, blocked while viewing-as.
   --------------------------------------------------------------------------- */

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth, requireModuleAccess , requireModuleAction} from "@/lib/server/auth";

export async function DELETE(
  req: Request,
  ctx: { params: Promise<{ id: string; eventId: string }> },
) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAction(auth, "Suppliers", "delete");
  if (deny) return deny;

  const { id, eventId } = await ctx.params;
  const tid = auth.tenant_id;

  const { error } = await supabaseServer
    .from("supplier_timeline_events")
    .delete()
    .eq("id", eventId).eq("tenant_id", tid).eq("supplier_id", id)
    .eq("is_manual", true);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
