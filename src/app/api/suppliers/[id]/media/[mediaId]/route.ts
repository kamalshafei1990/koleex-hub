import "server-only";

/* ---------------------------------------------------------------------------
   PATCH  /api/suppliers/[id]/media/[mediaId] — edit metadata / verify /
          change visibility / lifecycle.
   DELETE /api/suppliers/[id]/media/[mediaId] — remove (soft delete).

   Whitelisted, tenant + supplier scoped, Suppliers-module gated, blocked while
   viewing-as. A `verify:true` body stamps verified_by/verified_at; `verify:false`
   clears them. DELETE sets deleted_at (governed media + storage object kept for
   audit).
   --------------------------------------------------------------------------- */

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth, requireModuleAccess } from "@/lib/server/auth";
import { buildMediaPatch, validateMediaPatch } from "@/lib/suppliers/media-fields";

type Params = { params: Promise<{ id: string; mediaId: string }> };

async function guard(req: Request) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return { auth: null as never, res: auth };
  const deny = await requireModuleAccess(auth, "Suppliers");
  if (deny) return { auth: null as never, res: deny };
  return { auth, res: null };
}

export async function PATCH(req: Request, ctx: Params) {
  const { auth, res } = await guard(req);
  if (res) return res;
  const { id, mediaId } = await ctx.params;
  const tid = auth.tenant_id;

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const patch = buildMediaPatch(body);
  const verr = validateMediaPatch(patch);
  if (verr) return NextResponse.json({ error: verr }, { status: 400 });

  // Verification stamp (separate from the whitelist).
  if (body.verify === true) {
    patch.verified_by = auth.account_id ?? null;
    patch.verified_at = new Date().toISOString();
    if (patch.lifecycle_status == null) patch.lifecycle_status = "active";
  } else if (body.verify === false) {
    patch.verified_by = null;
    patch.verified_at = null;
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "No editable fields supplied" }, { status: 400 });
  }
  patch.updated_at = new Date().toISOString();

  const { error } = await supabaseServer
    .from("supplier_media")
    .update(patch)
    .eq("id", mediaId).eq("tenant_id", tid).eq("supplier_id", id)
    .neq("media_class", "qr_code");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request, ctx: Params) {
  const { auth, res } = await guard(req);
  if (res) return res;
  const { id, mediaId } = await ctx.params;
  const tid = auth.tenant_id;

  const { error } = await supabaseServer
    .from("supplier_media")
    .update({ deleted_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq("id", mediaId).eq("tenant_id", tid).eq("supplier_id", id)
    .neq("media_class", "qr_code");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
