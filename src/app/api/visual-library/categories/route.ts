import "server-only";

/* ---------------------------------------------------------------------------
   /api/visual-library/categories — icon categories for the Visual Library.

   GET  → the full category list = the built-in defaults (GENERAL_ICON_CATEGORIES,
          always present, defined in code) merged with this tenant's custom
          categories from visual_icon_categories. Any authenticated user.
   POST → add a custom category { label, code?, description? }. Database-module
          gated. key is slugified from the label and must be unique per tenant
          (and not collide with a built-in key). Additive only.
   --------------------------------------------------------------------------- */

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth, requireModuleAccess } from "@/lib/server/auth";
import { GENERAL_ICON_CATEGORIES } from "@/lib/visual-library/taxonomy";

type Cat = { key: string; label: string; code: string; custom?: boolean };

const BUILT_IN: Cat[] = GENERAL_ICON_CATEGORIES.map((c) => ({ key: c.key, label: c.label, code: c.code }));
const BUILT_IN_KEYS = new Set(BUILT_IN.map((c) => c.key));

function slugify(s: string): string {
  return s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}
function deriveCode(label: string): string {
  const alnum = label.toUpperCase().replace(/[^A-Z0-9]/g, "");
  return (alnum.slice(0, 4) || "CAT");
}

export async function GET() {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const { data, error } = await supabaseServer
    .from("visual_icon_categories")
    .select("key, label, code, sort_order, created_at")
    .eq("tenant_id", auth.tenant_id)
    .eq("is_active", true)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) {
    console.error("[api/visual-library/categories GET]", error.message);
    // Fall back to the built-in defaults so the UI never breaks.
    return NextResponse.json({ categories: BUILT_IN });
  }

  const custom: Cat[] = (data ?? [])
    .filter((r) => !BUILT_IN_KEYS.has(r.key as string))
    .map((r) => ({ key: r.key as string, label: r.label as string, code: (r.code as string) ?? deriveCode(r.label as string), custom: true }));

  return NextResponse.json({ categories: [...BUILT_IN, ...custom] });
}

export async function POST(req: Request) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAccess(auth, "Database");
  if (deny) return deny;

  let body: { label?: string; code?: string; description?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid body" }, { status: 400 }); }

  const label = (body.label ?? "").trim();
  if (!label) return NextResponse.json({ error: "label is required" }, { status: 400 });
  if (label.length > 60) return NextResponse.json({ error: "label too long" }, { status: 400 });

  const key = slugify(label);
  if (!key) return NextResponse.json({ error: "label must contain letters or numbers" }, { status: 400 });
  if (BUILT_IN_KEYS.has(key)) return NextResponse.json({ error: "A built-in category with that name already exists" }, { status: 409 });

  const code = (body.code ?? "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6) || deriveCode(label);
  const description = (body.description ?? "").trim() || null;

  // Place new categories after any existing custom ones.
  const { data: maxRow } = await supabaseServer
    .from("visual_icon_categories")
    .select("sort_order")
    .eq("tenant_id", auth.tenant_id)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  const sort_order = ((maxRow?.sort_order as number) ?? 0) + 1;

  const { data, error } = await supabaseServer
    .from("visual_icon_categories")
    .insert({ tenant_id: auth.tenant_id, key, label, code, description, sort_order, created_by: auth.account_id ?? null })
    .select("key, label, code")
    .single();
  if (error) {
    if (error.code === "23505") return NextResponse.json({ error: "That category already exists" }, { status: 409 });
    console.error("[api/visual-library/categories POST]", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, category: { ...data, custom: true } });
}
