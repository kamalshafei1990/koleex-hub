import "server-only";

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth, requireModuleAccess } from "@/lib/server/auth";
import { assertScopeShadowForRow, toScopeContext } from "@/lib/server/apply-scope";
import { getScopeMode } from "@/lib/server/scope-flags";

type RouteCtx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: RouteCtx) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAccess(auth, "Quotations");
  if (deny) return deny;
  const { id } = await params;

  /* NOTE: the `customers` pricing-engine table has columns
     (id, name, company_name, ...) — NOT display_name. The embedded
     select previously asked for display_name which tripped PostgREST
     and made this endpoint return 500, which left the detail page
     stuck on the loading spinner forever. Keep the column list
     aligned with the real schema. */
  const { data, error } = await supabaseServer
    .from("quotations")
    .select(`*, customer:customer_id ( id, name, company_name )`)
    .eq("id", id)
    .eq("tenant_id", auth.tenant_id)
    .maybeSingle();
  if (error) {
    console.error("[api/quotations/[id] GET]", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });

  /* DS1b-1 — single-row data_scope SHADOW (log-only). Runs only when the
     Quotations flag is "shadow"; never alters the response or status code,
     never hides the row. Reads created_by from the already-fetched row. */
  if (getScopeMode("Quotations") === "shadow") {
    await assertScopeShadowForRow({
      row: data as Record<string, unknown>,
      ctx: toScopeContext(auth),
      module: "Quotations",
      endpoint: "GET /api/quotations/[id]",
      db: supabaseServer,
      mode: "shadow",
    });
  }

  return NextResponse.json({ quotation: data });
}

export async function DELETE(_req: Request, { params }: RouteCtx) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAccess(auth, "Quotations");
  if (deny) return deny;
  const { id } = await params;

  const { error } = await supabaseServer
    .from("quotations")
    .delete()
    .eq("id", id)
    .eq("tenant_id", auth.tenant_id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
