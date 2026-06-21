import "server-only";

/* POST /api/commercial-policy/fx/refresh
   Manual "Update FX" button. Fetches the live CNY-per-USD rate and writes
   it into the caller's tenant `commercial_settings`. Gated to the same
   policy-admin roles as the editor. Returns the fresh settings row so the
   client can patch its snapshot without a second round-trip. */

import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/server/auth";
import { supabaseServer } from "@/lib/server/supabase-server";
import { fetchCnyPerUsd } from "@/lib/server/fx";
import { bustPolicySnapshot } from "@/lib/server/commercial-policy";

const POLICY_ADMIN_ROLES = new Set<string>([
  "super_admin",
  "admin",
  "general_manager",
]);

async function callerHasPolicyAccess(
  roleId: string | null,
  isSuperAdmin: boolean,
): Promise<boolean> {
  if (isSuperAdmin) return true;
  if (!roleId) return false;
  const { data } = await supabaseServer
    .from("roles")
    .select("slug")
    .eq("id", roleId)
    .maybeSingle();
  const slug = (data as { slug?: string } | null)?.slug;
  return !!slug && POLICY_ADMIN_ROLES.has(slug);
}

export async function POST() {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const allowed = await callerHasPolicyAccess(auth.role_id, auth.is_super_admin);
  if (!allowed) {
    return NextResponse.json(
      { error: "Not authorised to edit the commercial policy" },
      { status: 403 },
    );
  }

  let fx;
  try {
    fx = await fetchCnyPerUsd();
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "FX provider unavailable" },
      { status: 502 },
    );
  }

  const { error } = await supabaseServer
    .from("commercial_settings")
    .update({
      fx_cny_per_usd: fx.rate,
      updated_at: fx.fetchedAt,
      updated_by: auth.account_id,
    })
    .eq("tenant_id", auth.tenant_id);
  if (error) {
    console.error("[cp/fx/refresh]", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  bustPolicySnapshot(auth.tenant_id);
  const { data } = await supabaseServer
    .from("commercial_settings")
    .select("*")
    .eq("tenant_id", auth.tenant_id)
    .maybeSingle();

  return NextResponse.json({
    ok: true,
    rate: fx.rate,
    source: fx.source,
    fetchedAt: fx.fetchedAt,
    payload: data ?? null,
  });
}
