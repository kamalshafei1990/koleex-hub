import "server-only";

/* ---------------------------------------------------------------------------
   GET  /api/catalogs — list catalogs for the caller's tenant (newest first).
   POST /api/catalogs — create a catalog row (tenant_id enforced from session).

   Catalog file/cover bytes live in Supabase Storage; this table holds only
   the metadata. RLS is on with no anon policy, so all access goes through the
   service-role server client here. Writes require the Suppliers module.
   --------------------------------------------------------------------------- */

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth, requireModuleAccess, requireModuleAction } from "@/lib/server/auth";

/* Columns a client is allowed to set. Everything else (id, tenant_id,
   created_by, timestamps) is owned by the server. */
const WRITABLE = [
  "title", "title_cn", "description",
  "contact_id", "contact_name", "company_name_en", "company_name_cn", "contact_type", "contact_photo_url",
  "division_slug", "division_name", "category_slug", "category_name",
  "category_slugs", "category_names",
  "file_name", "file_path", "file_url", "file_type", "file_size",
  "cover_url", "cover_path", "tags", "year", "valid_until", "page_count",
] as const;

function pickWritable(body: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const k of WRITABLE) if (k in body) out[k] = body[k];
  return out;
}

export async function GET() {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  /* Same module gate as the file-streaming route (/api/files/catalog/…).
     The two MUST agree: when the list was ungated but files were gated, a
     role without Catalogs view (e.g. Data Entry before 2026-07-21, or the
     Customer portal role) saw every catalog card but every preview/download
     404'd — a silently broken app. One coherent switch, controlled from
     Roles & Permissions. */
  const denied = await requireModuleAccess(auth, "catalogs");
  if (denied) return denied;

  const { data, error } = await supabaseServer
    .from("catalogs")
    .select("*")
    .eq("tenant_id", auth.tenant_id)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[api/catalogs GET]", error.message);
    return NextResponse.json({ error: "Failed to load catalogs" }, { status: 500 });
  }
  return NextResponse.json({ catalogs: data ?? [] }, {
    headers: { "Cache-Control": "private, max-age=10, stale-while-revalidate=60" },
  });
}

export async function POST(req: Request) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  const deny = await requireModuleAction(auth, "Suppliers", "create");
  if (deny) return deny;

  const body = (await req.json()) as Record<string, unknown>;
  const row = pickWritable(body);
  if (typeof row.title !== "string" || !(row.title as string).trim()) {
    return NextResponse.json({ error: "Title is required" }, { status: 400 });
  }
  row.tenant_id = auth.tenant_id;
  row.created_by = auth.account_id ?? null;
  row.created_by_name = auth.username || auth.login_email || "System";

  const { data, error } = await supabaseServer
    .from("catalogs")
    .insert(row)
    .select("*")
    .single();

  if (error) {
    console.error("[api/catalogs POST]", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ catalog: data });
}
