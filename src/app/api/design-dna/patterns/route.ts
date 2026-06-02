import "server-only";

/* /api/design-dna/patterns — approved KOLEEX visual patterns. */

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth, requireModuleAccess } from "@/lib/server/auth";

export async function GET(req: Request) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAccess(auth, "Database");
  if (deny) return deny;

  const { data, error } = await supabaseServer.from("design_dna_patterns")
    .select("*").eq("tenant_id", auth.tenant_id).order("pattern_name", { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ patterns: data ?? [] });
}
