import "server-only";

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth, requireModuleAccess, requireModuleAction } from "@/lib/server/auth";
import { logAudit } from "@/lib/server/audit";
import { assertScopeShadowForRow, toScopeContext } from "@/lib/server/apply-scope";
import { getScopeMode } from "@/lib/server/scope-flags";
import { isCustomerEnforced, ownsQuotation } from "@/lib/server/customer-quotation-guard";
import { sanitizeQuotationDoc } from "@/lib/server/sensitive-columns";

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

  /* CQE — Customer-only enforcement: an external/customer account may only
     open a quotation it created. Returns the same 404 as "not found" (no
     existence leak). Inert when the flag is off → internal/SA unchanged. */
  if (
    await isCustomerEnforced(auth, supabaseServer) &&
    !ownsQuotation(data as { created_by?: string | null }, auth.account_id)
  ) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

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

  /* Column-level policy: the doc embeds supplier costs + pricing automation
     (costHead per line, standTablePrice, fxRate, margin defaults). Stripped
     unless the caller's role has can_view_private — the editor's cost gutter
     simply stays empty for them; a save merges existing costs back server-side. */
  return NextResponse.json({
    quotation: {
      ...(data as Record<string, unknown>),
      doc: sanitizeQuotationDoc(auth, (data as { doc?: Record<string, unknown> }).doc ?? {}),
    },
  });
}

export async function DELETE(req: Request, { params }: RouteCtx) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAction(auth, "Quotations", "delete");
  if (deny) return deny;
  const { id } = await params;

  const { error } = await supabaseServer
    .from("quotations")
    .delete()
    .eq("id", id)
    .eq("tenant_id", auth.tenant_id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await logAudit({
    auth,
    action_type: "delete",
    entity_type: "quotation",
    entity_id: id,
    severity: "critical",
    module: "Quotations",
    route: "/quotations",
    req,
  });

  return NextResponse.json({ ok: true });
}
