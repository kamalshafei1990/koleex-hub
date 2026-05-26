import "server-only";

import { NextResponse } from "next/server";
import { requireAuth, requireModuleAccess } from "@/lib/server/auth";
import { supabaseServer } from "@/lib/server/supabase-server";

/* ---------------------------------------------------------------------------
   GET /api/products/[id]/template-meta

   Resolve { template_id, template_slug, template_name } for a product.
   Used by the dynamic template renderer so callers don't have to know
   which template a product is bound to up-front.

   Returns 200 with `templateSlug: null` when the product exists but
   has no template_id assigned (legacy / hard-coded form path).
   --------------------------------------------------------------------------- */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAccess(auth, "Product Data");
  if (deny) return deny;

  const { id } = await ctx.params;
  if (!UUID_RE.test(id)) {
    return NextResponse.json({ error: "id must be a UUID" }, { status: 400 });
  }

  const { data, error } = await supabaseServer
    .from("products")
    .select(
      `id, tenant_id, template_id,
       template:product_templates(id, slug, name, is_active)`,
    )
    .eq("id", id)
    .maybeSingle();
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: "Product not found" }, { status: 404 });
  }
  const row = data as {
    id: string;
    tenant_id: string;
    template_id: string | null;
    template: { id?: string; slug?: string; name?: string; is_active?: boolean }
      | Array<{ id?: string; slug?: string; name?: string; is_active?: boolean }>
      | null;
  };
  if (!auth.is_super_admin && row.tenant_id !== auth.tenant_id) {
    return NextResponse.json({ error: "Product not in your tenant" }, { status: 403 });
  }

  const tpl = Array.isArray(row.template) ? row.template[0] : row.template;
  const active = tpl?.is_active !== false;

  return NextResponse.json({
    templateId: row.template_id,
    templateSlug: active ? tpl?.slug ?? null : null,
    templateName: active ? tpl?.name ?? null : null,
  });
}
