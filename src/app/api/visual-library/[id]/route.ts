import "server-only";

/* ---------------------------------------------------------------------------
   /api/visual-library/[id] — edit, approve, archive a single asset.

   PATCH  → update governed metadata, OR run an action:
              { action: "approve" }   → approval_status=approved + approved_by/at
              { action: "unapprove" } → approval_status=draft
              { action: "deprecate" } → approval_status=deprecated
              { action: "archive" }   → status=archived, is_active=false
              { action: "restore" }   → status=active, is_active=true
   DELETE → soft archive (never hard-delete user data).

   Tenant-scoped, Database-module gated, blocked while viewing-as.
   --------------------------------------------------------------------------- */

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth, requireModuleAccess } from "@/lib/server/auth";
import { buildAssetPatch, validateAssetPatch } from "@/lib/visual-library/asset-fields";

async function loadOwned(id: string, tenantId: string) {
  const { data } = await supabaseServer
    .from("visual_assets")
    .select("id, tenant_id")
    .eq("id", id)
    .eq("tenant_id", tenantId)
    .maybeSingle();
  return data;
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAccess(auth, "Database");
  if (deny) return deny;

  const { id } = await ctx.params;
  const owned = await loadOwned(id, auth.tenant_id);
  if (!owned) return NextResponse.json({ error: "Asset not found" }, { status: 404 });

  let body: Record<string, unknown>;
  try { body = (await req.json()) as Record<string, unknown>; }
  catch { return NextResponse.json({ error: "Invalid body" }, { status: 400 }); }

  const action = typeof body.action === "string" ? body.action : "";
  let patch: Record<string, unknown> = {};

  if (action) {
    switch (action) {
      case "approve":
        patch = { approval_status: "approved", approved_by: auth.account_id ?? null, approved_at: new Date().toISOString() };
        break;
      case "unapprove":
        patch = { approval_status: "draft", approved_by: null, approved_at: null };
        break;
      case "deprecate":
        patch = { approval_status: "deprecated" };
        break;
      case "archive":
        patch = { status: "archived", is_active: false };
        break;
      case "restore":
        patch = { status: "active", is_active: true };
        break;
      default:
        return NextResponse.json({ error: "Unknown action" }, { status: 400 });
    }
  } else {
    patch = buildAssetPatch(body);
    const verr = validateAssetPatch(patch);
    if (verr) return NextResponse.json({ error: verr }, { status: 400 });
    if (Object.keys(patch).length === 0) {
      return NextResponse.json({ error: "No editable fields" }, { status: 400 });
    }
  }

  const { error } = await supabaseServer
    .from("visual_assets")
    .update(patch)
    .eq("id", id)
    .eq("tenant_id", auth.tenant_id);
  if (error) {
    console.error("[api/visual-library PATCH]", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAccess(auth, "Database");
  if (deny) return deny;

  const { id } = await ctx.params;
  const owned = await loadOwned(id, auth.tenant_id);
  if (!owned) return NextResponse.json({ error: "Asset not found" }, { status: 404 });

  // Soft archive — never hard-delete the user's curated assets.
  const { error } = await supabaseServer
    .from("visual_assets")
    .update({ status: "archived", is_active: false })
    .eq("id", id)
    .eq("tenant_id", auth.tenant_id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
