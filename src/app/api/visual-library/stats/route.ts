import "server-only";

/* ---------------------------------------------------------------------------
   GET /api/visual-library/stats — lightweight counts for the dashboard KPIs.
   Tenant-scoped, Database-module gated.
   --------------------------------------------------------------------------- */

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth, requireModuleAccess } from "@/lib/server/auth";

async function countWhere(tenantId: string, apply: (q: ReturnType<typeof base>) => ReturnType<typeof base>) {
  const q = apply(base(tenantId));
  const { count, error } = await q;
  if (error) return 0;
  return count ?? 0;
}
function base(tenantId: string) {
  return supabaseServer
    .from("visual_assets")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", tenantId);
}

export async function GET(req: Request) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAccess(auth, "Database");
  if (deny) return deny;

  const tid = auth.tenant_id;
  const [total, approved, pending, drafts, missing, archived] = await Promise.all([
    countWhere(tid, (q) => q),
    countWhere(tid, (q) => q.eq("approval_status", "approved")),
    countWhere(tid, (q) => q.eq("approval_status", "pending")),
    countWhere(tid, (q) => q.eq("approval_status", "draft")),
    countWhere(tid, (q) => q.is("svg_path", null)),
    countWhere(tid, (q) => q.eq("status", "archived")),
  ]);

  return NextResponse.json({ total, approved, pending, drafts, missing, archived });
}
