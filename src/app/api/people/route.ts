import "server-only";

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth } from "@/lib/server/auth";

/* GET /api/people — person profiles in the caller's tenant.
   Any authenticated user can list people (they feed the Person picker
   in the AccountForm). Tenant-scoped. */

export async function GET() {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const { data, error } = await supabaseServer
    .from("people")
    .select("*")
    .eq("tenant_id", auth.tenant_id)
    .order("full_name", { ascending: true });

  if (error) {
    console.error("[api/people]", error.message);
    return NextResponse.json({ error: "Failed to load people" }, { status: 500 });
  }
  return NextResponse.json({ people: data ?? [] });
}
