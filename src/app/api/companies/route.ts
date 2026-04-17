import "server-only";

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth } from "@/lib/server/auth";

/* GET /api/companies — companies (workspaces) in the caller's tenant.
   Any authenticated user can list companies — they're needed by the
   AccountForm's Company picker etc. Tenant-scoped. */

export async function GET() {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const { data, error } = await supabaseServer
    .from("companies")
    .select("*")
    .eq("tenant_id", auth.tenant_id)
    .order("name", { ascending: true });

  if (error) {
    console.error("[api/companies]", error.message);
    return NextResponse.json({ error: "Failed to load companies" }, { status: 500 });
  }
  return NextResponse.json({ companies: data ?? [] });
}
