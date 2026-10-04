import "server-only";

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth, requireModuleAction } from "@/lib/server/auth";

/* DELETE /api/calendar/holidays/[id] — soft-delete (is_active=false) a holiday.
   Super Admin only, tenant-scoped (a tenant-less session touches only the
   tenant-less rows). The Calendar's holidays panel calls it. (Report GEN-10) */
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
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  let q = supabaseServer
    .from("koleex_holidays")
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq("id", id);
  q = auth.tenant_id ? q.eq("tenant_id", auth.tenant_id) : q.is("tenant_id", null);
  const { data, error } = await q.select("id");
  if (error) {
    console.error("[api/calendar/holidays DELETE]", error.message);
    return NextResponse.json({ error: "Failed to delete holiday" }, { status: 500 });
  }
  if (!data || data.length === 0) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
