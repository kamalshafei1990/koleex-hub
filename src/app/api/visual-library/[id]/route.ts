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
import { logVisualAssetEvent } from "@/lib/visual-library/events";

async function loadOwned(id: string, tenantId: string) {
  const { data } = await supabaseServer
    .from("visual_assets")
    .select("id, tenant_id, svg_path, version, usage_count")
    .eq("id", id)
    .eq("tenant_id", tenantId)
    .maybeSingle();
  return data as { id: string; tenant_id: string; svg_path: string | null; version: number; usage_count: number } | null;
}

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAccess(auth, "Database");
  if (deny) return deny;
  const { id } = await ctx.params;
  const { data, error } = await supabaseServer.from("visual_assets").select("*").eq("id", id).eq("tenant_id", auth.tenant_id).maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Asset not found" }, { status: 404 });
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const bucket = (data.storage_bucket as string) || "media";
  const path = data.svg_path as string | null;
  const asset = { ...data, public_url: path ? `${base}/storage/v1/object/public/${bucket}/${path}` : null };
  return NextResponse.json({ asset });
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

  // Attaching / replacing a file on an existing entity (turns "Missing" into a real asset).
  const incomingPath = typeof body.svg_path === "string" ? body.svg_path.trim() : "";
  if (!action && incomingPath) {
    patch = {
      svg_path: incomingPath,
      file_type: typeof body.file_type === "string" ? body.file_type : "svg",
      storage_bucket: typeof body.storage_bucket === "string" ? body.storage_bucket : "media",
      viewbox: typeof body.viewbox === "string" ? body.viewbox : null,
      file_size: typeof body.file_size === "number" ? body.file_size : null,
      mime_type: typeof body.mime_type === "string" ? body.mime_type : null,
      // First file → move out of "missing" into draft; a replacement bumps version.
      approval_status: owned.svg_path ? undefined : "draft",
      version: owned.svg_path ? (owned.version ?? 1) + 1 : (owned.version ?? 1),
    };
    Object.keys(patch).forEach((k) => patch[k] === undefined && delete patch[k]);
    const { error } = await supabaseServer.from("visual_assets").update(patch).eq("id", id).eq("tenant_id", auth.tenant_id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    await logVisualAssetEvent({
      tenantId: auth.tenant_id, assetId: id, actorId: auth.account_id ?? null,
      eventType: owned.svg_path ? "file_replaced" : "file_attached",
      summary: owned.svg_path ? `Icon replaced (v${(owned.version ?? 1) + 1})` : "Icon file attached",
    });
    return NextResponse.json({ ok: true });
  }

  if (action) {
    switch (action) {
      case "approve":
        patch = { approval_status: "approved", approved_by: auth.account_id ?? null, approved_at: new Date().toISOString() };
        break;
      case "submit":
        patch = { approval_status: "pending" };
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
      case "use":
        patch = { usage_count: (owned.usage_count ?? 0) + 1 };
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
  // Audit log for lifecycle actions (skip the noisy "use" counter + plain edits).
  const LOGGED: Record<string, string> = {
    approve: "Approved", unapprove: "Approval removed", submit: "Submitted for review",
    deprecate: "Deprecated", archive: "Archived", restore: "Restored",
  };
  if (action && LOGGED[action]) {
    await logVisualAssetEvent({
      tenantId: auth.tenant_id, assetId: id, actorId: auth.account_id ?? null,
      eventType: action, summary: LOGGED[action],
    });
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
