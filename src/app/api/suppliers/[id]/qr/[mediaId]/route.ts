import "server-only";

/* ---------------------------------------------------------------------------
   DELETE /api/suppliers/[id]/qr/[mediaId] — remove a QR code (soft delete).

   Sets deleted_at so the governed media row (and its storage object) is
   preserved for audit. Tenant + supplier scoped, Suppliers-module gated,
   blocked while viewing-as.
   --------------------------------------------------------------------------- */

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth, requireModuleAccess , requireModuleAction} from "@/lib/server/auth";

export async function DELETE(
  req: Request,
  ctx: { params: Promise<{ id: string; mediaId: string }> },
) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAction(auth, "Suppliers", "delete");
  if (deny) return deny;

  const { id, mediaId } = await ctx.params;
  const tid = auth.tenant_id;

  const { error } = await supabaseServer
    .from("supplier_media")
    .update({ deleted_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq("id", mediaId)
    .eq("tenant_id", tid)
    .eq("supplier_id", id)
    .eq("media_class", "qr_code");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
