import "server-only";

/* ===========================================================================
   GET  /api/finance/setup/base-currency        — read tenant default
   PATCH /api/finance/setup/base-currency       — update tenant default
   ========================================================================== */

import { NextResponse } from "next/server";
import { requireAuth, requireModuleAccess } from "@/lib/server/auth";
import { supabaseServer } from "@/lib/server/supabase-server";

export async function GET() {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAccess(auth, "Finance");
  if (deny) return deny;

  const { data } = await supabaseServer
    .from("tenants")
    .select("default_currency")
    .eq("id", auth.tenant_id)
    .maybeSingle();
  return NextResponse.json({
    base_currency: ((data as { default_currency: string | null } | null)?.default_currency) ?? "USD",
  });
}

export async function PATCH(req: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAccess(auth, "Finance");
  if (deny) return deny;

  const body = (await req.json().catch(() => null)) as { base_currency?: string } | null;
  const code = body?.base_currency?.trim().toUpperCase();
  if (!code || !/^[A-Z]{3}$/.test(code)) {
    return NextResponse.json({ error: "base_currency must be a 3-letter ISO code (e.g. USD, EUR, AED)" }, { status: 400 });
  }
  const { error } = await supabaseServer
    .from("tenants")
    .update({ default_currency: code })
    .eq("id", auth.tenant_id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ base_currency: code });
}
