import "server-only";

/* GET /api/brand-center/designs/<id>/template — a designer's template
   (plan step C18): a design of kind "template" whose SVG files are the
   artwork, front then back. Returns the SVG text of each (up to two, 3 MB
   each) for the studio to read its named layers as slots. The browser
   cleans every file before drawing it (svg-template.tsx); here it is text,
   never served as a document. Brand Center "view" for a design in use;
   a draft or a retired one only for someone who may edit (the owner tries
   it before putting it in use). */

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth } from "@/lib/server/auth";
import { brandCenterGate } from "@/lib/server/brand-center/access";
import { BRAND_BUCKET } from "@/lib/server/brand-center/library";

export const dynamic = "force-dynamic";

const MAX_SVG = 3 * 1024 * 1024;

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await brandCenterGate(auth, "view");
  if (deny) return deny;
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const { data: design } = await supabaseServer.from("brand_designs").select("id, name, kind, status")
    .eq("tenant_id", auth.tenant_id).eq("id", id).maybeSingle();
  if (!design || design.kind !== "template") return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (design.status !== "active" && (await brandCenterGate(auth, "edit"))) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const { data: rows, error } = await supabaseServer.from("brand_files")
    .select("id, file_name, storage_path, size_bytes, width_mm, height_mm, purpose")
    .eq("tenant_id", auth.tenant_id).eq("design_id", id).eq("purpose", "svg").order("created_at", { ascending: true }).limit(20);
  if (error) {
    console.error("[api/brand-center/designs template]", error.message);
    return NextResponse.json({ error: "Could not load the template." }, { status: 500 });
  }
  /* front first, a file named "back" second; two sides at most */
  const files = (rows ?? []).filter((f) => (f.size_bytes ?? 0) <= MAX_SVG)
    .sort((a, b) => Number(/back/i.test(a.file_name)) - Number(/back/i.test(b.file_name))).slice(0, 2);
  if (!files.length) return NextResponse.json({ error: "no_svg" }, { status: 404 });

  const pages = [];
  for (const f of files) {
    const { data: blob, error: dErr } = await supabaseServer.storage.from(BRAND_BUCKET).download(f.storage_path);
    if (dErr || !blob) {
      console.error("[api/brand-center/designs template download]", dErr?.message);
      return NextResponse.json({ error: "Could not load the template." }, { status: 500 });
    }
    if (blob.size > MAX_SVG) return NextResponse.json({ error: "too_big" }, { status: 413 });
    pages.push({ fileId: f.id, fileName: f.file_name, svg: await blob.text(), widthMm: f.width_mm, heightMm: f.height_mm });
  }
  return NextResponse.json({ design: { id: design.id, name: design.name }, pages }, { headers: { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" } });
}
