import "server-only";

/* ---------------------------------------------------------------------------
   GET /api/suppliers/[id]/section-audit — who last edited each department's
   section of this supplier record, and when. Powers the "Updated by <name> ·
   <date>" line on every section header of the supplier form.

   Tenant + supplier scoped, Suppliers-module gated.
   --------------------------------------------------------------------------- */

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth, requireModuleAccess } from "@/lib/server/auth";

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAccess(auth, "Suppliers");
  if (deny) return deny;

  const { id } = await ctx.params;

  const { data, error } = await supabaseServer
    .from("supplier_section_audit")
    .select("dept_key, edited_by_name, edited_at")
    .eq("tenant_id", auth.tenant_id)
    .eq("supplier_id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  /* Shape into a { dept_key: { name, at } } map for the client. */
  const map: Record<string, { name: string; at: string }> = {};
  for (const r of (data ?? []) as { dept_key: string; edited_by_name: string; edited_at: string }[]) {
    map[r.dept_key] = { name: r.edited_by_name, at: r.edited_at };
  }
  return NextResponse.json({ audit: map });
}
