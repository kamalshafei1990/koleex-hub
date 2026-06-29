import "server-only";

/* Catalogs belonging to a supplier.

   In this app a SUPPLIER *is* a row in `contacts` (contact_type='supplier') and
   the Catalogs app links each catalog straight to that contact via
   `catalogs.contact_id`. So the supplier id passed in IS the contact id, and a
   supplier's catalogs = catalogs where contact_id == id. Tenant-scoped,
   read-only. (Earlier this indirected through a non-existent `suppliers` table,
   which 404'd and showed "no catalogs" even when catalogs were linked.) */

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth } from "@/lib/server/auth";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const { id } = await ctx.params;

  // The supplier is a contacts row; load it for the name fallback + existence.
  const { data: sup, error: sErr } = await supabaseServer
    .from("contacts")
    .select("id, display_name, company, company_name_en, company_name_cn")
    .eq("tenant_id", auth.tenant_id)
    .eq("id", id)
    .maybeSingle();
  if (sErr) {
    console.error("[api/suppliers/[id]/catalogs supplier]", sErr.message);
    return NextResponse.json({ error: "Lookup failed." }, { status: 500 });
  }
  if (!sup) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const cols = "id, title, title_cn, description, cover_url, file_url, file_path, file_type, year, valid_until, page_count, category_name, category_names, contact_id, company_name_en, company_name_cn, created_at";

  // Primary link: catalogs filed directly against this supplier's contact id.
  const { data: linked, error: lErr } = await supabaseServer
    .from("catalogs")
    .select(cols)
    .eq("tenant_id", auth.tenant_id)
    .eq("contact_id", id)
    .order("created_at", { ascending: false });
  if (lErr) {
    console.error("[api/suppliers/[id]/catalogs by-contact]", lErr.message);
    return NextResponse.json({ error: "Lookup failed." }, { status: 500 });
  }

  const rows: Record<string, unknown>[] = [...(linked ?? [])];

  // Best-effort fallback: catalogs that name this company but were never linked
  // to the contact (e.g. uploaded before the supplier existed). Merge by id.
  const names = [sup.company_name_en, sup.company_name_cn, sup.display_name, sup.company]
    .map((s) => (s || "").trim())
    .filter((s) => s.length >= 3);
  if (names.length) {
    const ors: string[] = [];
    for (const nm of names) {
      const safe = nm.replace(/[%,()]/g, " ").trim();
      if (!safe) continue;
      ors.push(`company_name_en.ilike.%${safe}%`, `company_name_cn.ilike.%${safe}%`, `title.ilike.%${safe}%`);
    }
    if (ors.length) {
      const { data: byName } = await supabaseServer
        .from("catalogs")
        .select(cols)
        .eq("tenant_id", auth.tenant_id)
        .or(ors.join(","))
        .order("created_at", { ascending: false });
      const seen = new Set(rows.map((r) => String(r.id)));
      for (const r of byName ?? []) {
        if (!seen.has(String(r.id))) { seen.add(String(r.id)); rows.push(r as Record<string, unknown>); }
      }
    }
  }

  return NextResponse.json({ catalogs: rows });
}
