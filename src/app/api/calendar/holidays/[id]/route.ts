import "server-only";

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth, requireModuleAccess , requireModuleAction} from "@/lib/server/auth";

/* DELETE /api/calendar/holidays/[id] — soft-delete (is_active=false) a holiday.
   Super Admin only, tenant-scoped. (Report GEN-10) */
export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAction(auth, "Calendar", "delete");
  if (deny) return deny;
  if (!auth.is_super_admin) {
    return NextResponse.json({ error: "Only a Super Admin can manage holidays." }, { status: 403 });
  }

  const { id } = await ctx.params;
  const { error } = await supabaseServer
    .from("koleex_holidays")
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("tenant_id", auth.tenant_id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
