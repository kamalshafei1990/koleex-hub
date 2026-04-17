import "server-only";

/* GET /api/crm/stages — list CRM pipeline stages for the caller's tenant. */

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth, requireModuleAccess } from "@/lib/server/auth";

export async function GET() {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const deny = await requireModuleAccess(auth, "CRM");
  if (deny) return deny;

  const { data, error } = await supabaseServer
    .from("crm_stages")
    .select("*")
    .eq("tenant_id", auth.tenant_id)
    .order("sequence", { ascending: true });

  if (error) {
    console.error("[api/crm/stages]", error.message);
    return NextResponse.json({ error: "Failed to load stages" }, { status: 500 });
  }

  return NextResponse.json({ stages: data ?? [] });
}
