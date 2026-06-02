import "server-only";

/* /api/design-dna/profiles — DNA profiles + their rules. */

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth, requireModuleAccess } from "@/lib/server/auth";

export async function GET(req: Request) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAccess(auth, "Database");
  if (deny) return deny;

  const { data: profiles } = await supabaseServer.from("design_dna_profiles")
    .select("*").eq("tenant_id", auth.tenant_id).eq("status", "active").order("created_at", { ascending: true });
  const { data: rules } = await supabaseServer.from("design_dna_rules")
    .select("*").in("profile_id", (profiles ?? []).map((p) => p.id));
  const byProfile: Record<string, unknown[]> = {};
  for (const r of rules ?? []) (byProfile[r.profile_id as string] ??= []).push(r);
  return NextResponse.json({ profiles: (profiles ?? []).map((p) => ({ ...p, rules: byProfile[p.id as string] ?? [] })) });
}
