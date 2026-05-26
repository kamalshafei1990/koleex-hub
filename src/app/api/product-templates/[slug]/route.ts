import "server-only";

import { NextResponse } from "next/server";
import { requireAuth, requireModuleAccess } from "@/lib/server/auth";
import { supabaseServer } from "@/lib/server/supabase-server";
import type {
  ProductTemplate,
  ProductTemplateSection,
  ProductTemplateField,
  TemplateTree,
} from "@/lib/product-templates/types";

/* ---------------------------------------------------------------------------
   GET /api/product-templates/[slug]

   Returns a single template + its sections + their fields, nested into one
   tree so the renderer can paint without N+1 fetches. Structure is global
   (no tenant scoping) — gated by authentication only.
   --------------------------------------------------------------------------- */

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ slug: string }> },
) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  /* Same gate the product CRUD uses — anyone with Product Data access
     can read template structure; everyone else gets 403. */
  const deny = await requireModuleAccess(auth, "Product Data");
  if (deny) return deny;

  const { slug } = await ctx.params;
  if (!slug) {
    return NextResponse.json({ error: "Missing slug" }, { status: 400 });
  }

  /* Pull the template, sections, and fields in parallel. We could do
     a single nested PostgREST query, but explicit parallel queries are
     easier to read and the round-trip count is the same. */
  const tplRes = await supabaseServer
    .from("product_templates")
    .select("*")
    .eq("slug", slug)
    .eq("is_active", true)
    .maybeSingle();

  if (tplRes.error) {
    return NextResponse.json({ error: tplRes.error.message }, { status: 500 });
  }
  const template = tplRes.data as ProductTemplate | null;
  if (!template) {
    return NextResponse.json({ error: "Template not found" }, { status: 404 });
  }

  /* Filter to is_active rows only — soft-archived sections / fields
     are kept in the DB for audit but never rendered. */
  const [sectionsRes, fieldsRes] = await Promise.all([
    supabaseServer
      .from("product_template_sections")
      .select("*")
      .eq("template_id", template.id)
      .eq("is_active", true)
      .order("sort_order", { ascending: true }),
    supabaseServer
      .from("product_template_fields")
      .select(
        `id, section_id, template_id, field_key, field_label, field_type,
         unit, placeholder, help_text, icon, sort_order, is_required,
         is_public, is_searchable, ai_readable, show_in_brochure,
         show_in_quotation, show_in_catalog, options_json, is_active,
         created_at,
         section:product_template_sections!inner(template_id, is_active)`,
      )
      .eq("section.template_id", template.id)
      .eq("section.is_active", true)
      .eq("is_active", true)
      .order("sort_order", { ascending: true }),
  ]);

  if (sectionsRes.error) {
    return NextResponse.json({ error: sectionsRes.error.message }, { status: 500 });
  }
  if (fieldsRes.error) {
    return NextResponse.json({ error: fieldsRes.error.message }, { status: 500 });
  }

  const sections = (sectionsRes.data ?? []) as ProductTemplateSection[];
  const fields = (fieldsRes.data ?? []) as Array<
    ProductTemplateField & { section?: unknown }
  >;

  /* Bucket fields by section_id once, then assign in O(n) so order is
     preserved by the sort_order already applied above. */
  const bySection = new Map<string, ProductTemplateField[]>();
  for (const f of fields) {
    const { section: _section, ...rest } = f;
    const arr = bySection.get(f.section_id) ?? [];
    arr.push(rest as ProductTemplateField);
    bySection.set(f.section_id, arr);
  }

  const tree: TemplateTree = {
    ...template,
    sections: sections.map((s) => ({
      ...s,
      fields: bySection.get(s.id) ?? [],
    })),
  };

  return NextResponse.json(tree, {
    headers: {
      /* Structure changes are admin-rare. Short browser cache + longer
         SWR keeps re-renders cheap without going stale for long. */
      "Cache-Control": "private, max-age=60, stale-while-revalidate=600",
    },
  });
}
