import "server-only";

/* ---------------------------------------------------------------------------
   /api/suppliers/taxonomy — the Division → Category → Subcategory tree that
   drives the Koleex Main Suppliers board, read from the RUNTIME Supabase
   taxonomy (divisions / categories / subcategories — the same tables the
   /categories and /subcategories admin edit).

   This is what makes the board stay in sync: add or rename a category /
   subcategory, or swap an icon, and the board reflects it on next load. The
   per-subcategory coverage key is the `code` when set, else the `slug`, so
   every subcategory is assignable — including ones added via the admin that
   don't carry a KOLEEX code yet.

   Taxonomy tables are global (not tenant-scoped); still gated behind the
   Suppliers module. Service-role server client.
   --------------------------------------------------------------------------- */

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth, requireModuleAccess } from "@/lib/server/auth";
import type { TaxonomyDivision } from "@/lib/suppliers/coverage";

interface DivRow { id: string; slug: string | null; name: string | null; description: string | null; order: number | null }
interface CatRow { id: string; division_id: string | null; slug: string | null; name: string | null; description: string | null; order: number | null }
interface SubRow { id: string; category_id: string | null; slug: string | null; name: string | null; code: string | null; order: number | null }

export async function GET(req: Request) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAccess(auth, "Suppliers");
  if (deny) return deny;

  const [divRes, catRes, subRes] = await Promise.all([
    supabaseServer.from("divisions").select("id, slug, name, description, order").order("order", { ascending: true }),
    supabaseServer.from("categories").select("id, division_id, slug, name, description, order").order("order", { ascending: true }),
    supabaseServer.from("subcategories").select("id, category_id, slug, name, code, order").order("order", { ascending: true }),
  ]);

  if (divRes.error || catRes.error || subRes.error) {
    console.error("[api/suppliers/taxonomy]", divRes.error?.message || catRes.error?.message || subRes.error?.message);
    return NextResponse.json({ error: "Failed to load taxonomy" }, { status: 500 });
  }

  const divs = (divRes.data ?? []) as DivRow[];
  const cats = (catRes.data ?? []) as CatRow[];
  const subs = (subRes.data ?? []) as SubRow[];

  // subcategories grouped by category_id (de-duped by effective key within the category)
  const subsByCat = new Map<string, { key: string; code: string | null; label: string; slug: string }[]>();
  for (const s of subs) {
    if (!s.category_id) continue;
    const slug = (s.slug ?? "").trim();
    const code = (s.code ?? "").trim();
    const key = code || slug;             // coverage key: code when set, else slug
    if (!key) continue;
    const list = subsByCat.get(s.category_id) ?? [];
    if (list.some((x) => x.key === key)) continue;
    list.push({ key, code: code || null, label: (s.name ?? "").trim() || key, slug });
    subsByCat.set(s.category_id, list);
  }

  // categories grouped by division_id (only those with at least one usable subcategory)
  const catsByDiv = new Map<string, { slug: string; label: string; blurb: string; subcategories: { key: string; code: string | null; label: string; slug: string }[] }[]>();
  for (const c of cats) {
    if (!c.division_id) continue;
    const slug = (c.slug ?? "").trim();
    if (!slug) continue;
    const subcategories = subsByCat.get(c.id) ?? [];
    if (subcategories.length === 0) continue;   // nothing assignable here
    const list = catsByDiv.get(c.division_id) ?? [];
    list.push({ slug, label: (c.name ?? "").trim() || slug, blurb: (c.description ?? "").trim(), subcategories });
    catsByDiv.set(c.division_id, list);
  }

  const divisions: TaxonomyDivision[] = divs
    .filter((d) => (d.slug ?? "").trim())
    .map((d) => ({
      id: (d.slug ?? "").trim(),
      name: (d.name ?? "").trim() || (d.slug ?? "").trim(),
      description: (d.description ?? "").trim(),
      status: "live" as const,
      categories: catsByDiv.get(d.id) ?? [],
    }));

  return NextResponse.json({ divisions }, { headers: { "Cache-Control": "private, max-age=30, stale-while-revalidate=120" } });
}
