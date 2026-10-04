import "server-only";

/* ---------------------------------------------------------------------------
   /api/quotations/compact-images — move inline base64 line photos out of old
   quotation documents into storage, a few documents per call.

   GET  → { pending }         how many of the tenant's quotations still carry
                              a data:image URL in their doc.
   POST → { done, remaining } compacts up to BATCH documents (newest first)
                              and says how many are left; the client loops.

   Super-admin only: it rewrites documents wholesale. The rewrite touches
   `doc` alone — no version bump, no updated_by — so an editor that has one of
   these documents open keeps saving normally (its own copy simply wins for
   that document and it is compacted on a later run).
   --------------------------------------------------------------------------- */

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth } from "@/lib/server/auth";

export const maxDuration = 60;

const BUCKET = "media";
const BATCH = 4;

const EXT: Record<string, string> = { png: "png", jpeg: "jpg", jpg: "jpg", webp: "webp", gif: "gif" };

type Item = { image?: unknown } & Record<string, unknown>;

async function inlineToStorage(dataUrl: string, path: string): Promise<string | null> {
  const m = /^data:image\/(png|jpeg|jpg|webp|gif);base64,(.+)$/i.exec(dataUrl);
  if (!m) return null;
  const ext = EXT[m[1].toLowerCase()];
  const buf = Buffer.from(m[2], "base64");
  if (buf.length === 0 || buf.length > 4 * 1024 * 1024) return null;
  const full = `${path}.${ext}`;
  const { error } = await supabaseServer.storage
    .from(BUCKET)
    .upload(full, buf, { contentType: `image/${m[1].toLowerCase() === "jpg" ? "jpeg" : m[1].toLowerCase()}`, upsert: true, cacheControl: "31536000" });
  if (error) {
    console.error("[api/quotations/compact-images upload]", error.message);
    return null;
  }
  return supabaseServer.storage.from(BUCKET).getPublicUrl(full).data.publicUrl;
}

export async function GET() {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  if (!auth.is_super_admin) return NextResponse.json({ error: "Super-admin only." }, { status: 403 });
  const { data, error } = await supabaseServer.rpc("fn_quotations_inline_images_count", { p_tenant_id: auth.tenant_id });
  if (error) {
    console.error("[api/quotations/compact-images GET]", error.message);
    return NextResponse.json({ error: "Could not count." }, { status: 500 });
  }
  return NextResponse.json({ pending: Number(data) || 0 });
}

export async function POST(req: Request) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  if (!auth.is_super_admin) return NextResponse.json({ error: "Super-admin only." }, { status: 403 });

  const { data: rows, error } = await supabaseServer.rpc("fn_quotations_inline_images", {
    p_tenant_id: auth.tenant_id,
    p_limit: BATCH,
  });
  if (error) {
    console.error("[api/quotations/compact-images POST]", error.message);
    return NextResponse.json({ error: "Could not list documents." }, { status: 500 });
  }

  let done = 0;
  for (const r of (rows ?? []) as Array<{ id: string }>) {
    const { data: row } = await supabaseServer
      .from("quotations")
      .select("id, doc")
      .eq("id", r.id)
      .eq("tenant_id", auth.tenant_id)
      .maybeSingle();
    const doc = (row?.doc ?? null) as (Record<string, unknown> & { items?: Item[] }) | null;
    if (!doc || !Array.isArray(doc.items)) continue;

    let changed = false;
    const items: Item[] = [];
    for (let i = 0; i < doc.items.length; i++) {
      const it = doc.items[i];
      const img = typeof it?.image === "string" ? it.image : "";
      if (img.startsWith("data:image")) {
        const url = await inlineToStorage(img, `quotation-items/${auth.tenant_id}/${r.id}-${i}`);
        if (url) { items.push({ ...it, image: url }); changed = true; continue; }
      }
      items.push(it);
    }
    /* A stamp or signature pasted as a data URL is rare but the same weight. */
    const extras: Record<string, unknown> = {};
    for (const k of ["stampUrl", "signatureUrl"] as const) {
      const v = doc[k];
      if (typeof v === "string" && v.startsWith("data:image")) {
        const url = await inlineToStorage(v, `quotation-items/${auth.tenant_id}/${r.id}-${k}`);
        if (url) { extras[k] = url; changed = true; }
      }
    }
    if (!changed) continue;

    const { error: upErr } = await supabaseServer
      .from("quotations")
      .update({ doc: { ...doc, ...extras, items } })
      .eq("id", r.id)
      .eq("tenant_id", auth.tenant_id);
    if (upErr) {
      console.error("[api/quotations/compact-images update]", upErr.message);
      continue;
    }
    done++;
  }

  const { data: left } = await supabaseServer.rpc("fn_quotations_inline_images_count", { p_tenant_id: auth.tenant_id });
  return NextResponse.json({ done, remaining: Number(left) || 0 });
}
