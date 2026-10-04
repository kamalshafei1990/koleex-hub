import "server-only";

/* /api/brand-center/files/<id>
     GET     download: a link valid for 5 minutes, with the file's own name
             (anyone who may read Brand Center; a retired design's file only
             for someone who may edit)
     DELETE  removes the file from its design and from storage
             (Brand Center "delete") */

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth } from "@/lib/server/auth";
import { brandCenterGate } from "@/lib/server/brand-center/access";
import { BRAND_BUCKET } from "@/lib/server/brand-center/library";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };

async function own(tenantId: string, id: string) {
  const { data } = await supabaseServer.from("brand_files")
    .select("id, storage_path, file_name, design_id, brand_designs!inner(status)")
    .eq("tenant_id", tenantId).eq("id", id).maybeSingle();
  return data as unknown as { id: string; storage_path: string; file_name: string; brand_designs: { status: string } } | null;
}

export async function GET(_req: Request, { params }: Ctx) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await brandCenterGate(auth, "view");
  if (deny) return deny;
  const { id } = await params;
  const file = await own(auth.tenant_id, id);
  if (!file) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (file.brand_designs?.status === "retired" && (await brandCenterGate(auth, "edit"))) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  const { data, error } = await supabaseServer.storage.from(BRAND_BUCKET)
    .createSignedUrl(file.storage_path, 300, { download: file.file_name });
  if (error || !data?.signedUrl) {
    console.error("[api/brand-center/files GET]", error?.message);
    return NextResponse.json({ error: "Could not prepare the download." }, { status: 500 });
  }
  return NextResponse.redirect(data.signedUrl, { status: 302 });
}

export async function DELETE(req: Request, { params }: Ctx) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const deny = await brandCenterGate(auth, "delete");
  if (deny) return deny;
  const { id } = await params;
  const file = await own(auth.tenant_id, id);
  if (!file) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const { error } = await supabaseServer.from("brand_files").delete().eq("id", file.id);
  if (error) return NextResponse.json({ error: "Could not remove the file." }, { status: 500 });
  const { error: sErr } = await supabaseServer.storage.from(BRAND_BUCKET).remove([file.storage_path]);
  if (sErr) console.error("[api/brand-center/files DELETE storage]", sErr.message);
  return NextResponse.json({ ok: true });
}
