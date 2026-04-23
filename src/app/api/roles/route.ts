import "server-only";

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth } from "@/lib/server/auth";

/* GET  /api/roles    — list roles (any authenticated user)
   POST /api/roles    — create a new role (Super Admin only)

   The list is used by many pickers across the app (Account form,
   Employee wizard, Roles & Permissions admin, Management chart),
   so any logged-in user in the tenant can READ. Mutations require
   Super Admin. */

export async function GET() {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  /* Roles are GLOBAL (no tenant_id column) — role templates are shared
     across all tenants.

     The data is split across two tables for historical reasons:
       - `koleex_roles` has the richer admin fields (description,
         is_super_admin, can_view_private) used by the Roles admin page.
       - `roles` has the authoritative `scope` column ("internal" /
         "customer" / "all") that account pickers filter on.
     Returning only koleex_roles was producing an EMPTY dropdown in the
     Account form because the client filters by `scope` and no row had
     one. Merge here: koleex_roles rows + scope from `roles` matched by
     id, defaulting to "internal" when not found. */
  const [koleexRes, baseRes] = await Promise.all([
    supabaseServer
      .from("koleex_roles")
      .select("*")
      .order("name", { ascending: true }),
    supabaseServer
      .from("roles")
      .select("id, slug, scope")
      .order("name", { ascending: true }),
  ]);

  if (koleexRes.error && baseRes.error) {
    console.error("[api/roles GET]", koleexRes.error.message, baseRes.error.message);
    return NextResponse.json({ error: "Failed to load roles" }, { status: 500 });
  }

  type BaseRole = { id: string; slug: string | null; scope: string | null };
  const scopeById = new Map<string, string>();
  const slugById = new Map<string, string>();
  for (const r of ((baseRes.data ?? []) as BaseRole[])) {
    if (r.scope) scopeById.set(r.id, r.scope);
    if (r.slug) slugById.set(r.id, r.slug);
  }

  const koleexRows = (koleexRes.data ?? []) as Array<Record<string, unknown> & { id: string; name: string }>;

  // If koleex_roles is empty, fall back to returning roles as-is so the
  // dropdown still has options in a clean environment.
  if (koleexRows.length === 0) {
    return NextResponse.json(
      { roles: baseRes.data ?? [] },
      { headers: { "Cache-Control": "private, max-age=60, stale-while-revalidate=600" } },
    );
  }

  const merged = koleexRows.map((row) => ({
    ...row,
    scope: (row.scope as string | null | undefined) ?? scopeById.get(row.id) ?? "internal",
    slug: (row.slug as string | null | undefined) ?? slugById.get(row.id) ?? null,
  }));

  /* Roles rarely change during a session — they're admin-edited
     once in a while. Long cache + long SWR. */
  return NextResponse.json(
    { roles: merged },
    { headers: { "Cache-Control": "private, max-age=60, stale-while-revalidate=600" } },
  );
}

/** Slugify a role name: "Sales Rep" → "sales_rep". Roles table
 *  requires a NOT NULL slug; we derive one when callers don't pass
 *  it, matching the existing convention in bootstrap_production.sql. */
function deriveSlug(name: unknown, fallback: string): string {
  const raw = typeof name === "string" ? name : "";
  const slug = raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 48);
  return slug || fallback;
}

export async function POST(req: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  if (!auth.is_super_admin) {
    return NextResponse.json(
      { error: "Only Super Admin can create roles" },
      { status: 403 },
    );
  }

  const body = (await req.json()) as Record<string, unknown>;
  // Roles are global — no tenant_id column.
  delete body.tenant_id;
  const row = {
    ...body,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabaseServer
    .from("koleex_roles")
    .insert(row)
    .select("*")
    .single();
  if (error) {
    console.error("[api/roles POST]", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  /* Mirror the new role into the base `roles` table so that
     accounts.role_id (FK → roles.id) can reference it. Without this
     step, any role template created from AccessRightsTab
     ("Template created from X's access rights") becomes selectable
     in the Account form dropdown but blows up on save with a FK
     violation. Do the mirror best-effort — if it fails we still
     return the koleex_roles row, and we log the error for follow-up
     (instead of silently leaving an orphan). */
  const koleexRow = data as Record<string, unknown> & {
    id: string;
    name: string;
    description: string | null;
    is_super_admin: boolean;
    can_view_private: boolean;
  };
  const mirrorRow = {
    id: koleexRow.id,
    slug: deriveSlug(
      (body as { slug?: unknown }).slug ?? koleexRow.name,
      `role_${String(koleexRow.id).slice(0, 8)}`,
    ),
    name: koleexRow.name,
    description: koleexRow.description,
    scope: (body as { scope?: unknown }).scope ?? "internal",
    is_super_admin: koleexRow.is_super_admin,
    can_view_private: koleexRow.can_view_private,
  };
  const { error: mirrorErr } = await supabaseServer
    .from("roles")
    .upsert(mirrorRow, { onConflict: "id" });
  if (mirrorErr) {
    console.error("[api/roles POST] roles-mirror failed:", mirrorErr.message);
  }

  return NextResponse.json({ role: data });
}
