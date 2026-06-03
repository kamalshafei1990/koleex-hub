import "server-only";

/* ---------------------------------------------------------------------------
   PATCH  /api/catalogs/[id] — update a catalog (tenant-enforced).
   DELETE /api/catalogs/[id] — delete a catalog + its storage files.

   Writes require the Suppliers module. Always tenant-scoped so cross-tenant
   rows can't be touched.
   --------------------------------------------------------------------------- */

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth, requireModuleAccess } from "@/lib/server/auth";

const BUCKET = "media";

const WRITABLE = [
  "title", "title_cn", "description",
  "contact_id", "contact_name", "company_name_en", "company_name_cn", "contact_type",
  "division_slug", "division_name", "category_slug", "category_name",
  "file_name", "file_path", "file_url", "file_type", "file_size",
  "cover_url", "cover_path", "tags", "year", "valid_until", "page_count",
] as const;

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  const deny = await requireModuleAccess(auth, "Suppliers");
  if (deny) return deny;

  const body = (await req.json()) as Record<string, unknown>;
  const patch: Record<string, unknown> = {};
  for (const k of WRITABLE) if (k in body) patch[k] = body[k];
  patch.updated_at = new Date().toISOString();

  const { error } = await supabaseServer
    .from("catalogs")
    .update(patch)
    .eq("id", id)
    .eq("tenant_id", auth.tenant_id);

  if (error) {
    console.error("[api/catalogs PATCH]", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  const deny = await requireModuleAccess(auth, "Suppliers");
  if (deny) return deny;

  // Load the row (tenant-scoped) so we know which storage files to remove.
  const { data: row } = await supabaseServer
    .from("catalogs")
    .select("file_path, cover_path")
    .eq("id", id)
    .eq("tenant_id", auth.tenant_id)
    .maybeSingle();

  if (row) {
    const paths = [(row as { file_path?: string }).file_path, (row as { cover_path?: string }).cover_path]
      .filter((p): p is string => typeof p === "string" && p.length > 0);
    if (paths.length) {
      const { error: rmErr } = await supabaseServer.storage.from(BUCKET).remove(paths);
      if (rmErr) console.error("[api/catalogs DELETE] storage:", rmErr.message);
    }
  }

  const { error } = await supabaseServer
    .from("catalogs")
    .delete()
    .eq("id", id)
    .eq("tenant_id", auth.tenant_id);

  if (error) {
    console.error("[api/catalogs DELETE]", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
