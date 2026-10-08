import "server-only";

/* POST /api/brand-center/designs/<id>/files — add a file to a design.
   Brand Center "create". Two ways in, because the platform caps a request
   body at 4.5 MB:
     · multipart form with `file` (≤ 4.2 MB): the bytes come through here
       and we store them — the reliable path on every connection;
     · JSON { action: "sign", fileName, size, mime } for a larger file: we
       choose the path and return a one-shot signed upload token; the
       browser PUTs the bytes to storage, then calls
       JSON { action: "register", path, fileName, size, mime } and we check
       the object is really there before recording it.
   The bucket is private and not open to the Hub's general upload routes,
   so only someone with the Brand Center right can put a file in it. */

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth } from "@/lib/server/auth";
import { brandCenterGate } from "@/lib/server/brand-center/access";
import { BRAND_BUCKET, DIRECT_UPLOAD_OVER, MAX_FILE_BYTES, filePath, purposeOf, text } from "@/lib/server/brand-center/library";

export const dynamic = "force-dynamic";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const deny = await brandCenterGate(auth, "create");
  if (deny) return deny;
  const { id } = await params;
  const { data: design } = await supabaseServer.from("brand_designs").select("id, item_id")
    .eq("tenant_id", auth.tenant_id).eq("id", id).maybeSingle();
  if (!design) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const prefix = `${auth.tenant_id}/${design.item_id}/${design.id}/`;

  const record = async (path: string, fileName: string, size: number | null, mime: string | null) => {
    const { data, error } = await supabaseServer.from("brand_files").insert({
      tenant_id: auth.tenant_id, design_id: design.id, storage_path: path, file_name: fileName,
      mime, size_bytes: size, purpose: purposeOf(fileName), created_by: auth.account_id,
    }).select("id, design_id, file_name, mime, size_bytes, purpose, created_at").single();
    if (error) {
      console.error("[api/brand-center/files record]", error.message);
      return NextResponse.json({ error: "Could not save the file." }, { status: 500 });
    }
    return NextResponse.json({ file: data });
  };

  if ((req.headers.get("content-type") ?? "").includes("multipart/form-data")) {
    const form = await req.formData().catch(() => null);
    const file = form?.get("file");
    if (!(file instanceof File)) return NextResponse.json({ error: "file_required" }, { status: 400 });
    if (file.size > DIRECT_UPLOAD_OVER) return NextResponse.json({ error: "too_big_for_this_way" }, { status: 413 });
    const path = filePath(auth.tenant_id, design.item_id, design.id, file.name);
    const { error } = await supabaseServer.storage.from(BRAND_BUCKET)
      .upload(path, Buffer.from(await file.arrayBuffer()), { contentType: file.type || "application/octet-stream", upsert: false });
    if (error) {
      console.error("[api/brand-center/files upload]", error.message);
      return NextResponse.json({ error: "Could not store the file." }, { status: 500 });
    }
    return record(path, file.name.slice(0, 200), file.size, file.type || null);
  }

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const fileName = text(body?.fileName, 200);
  const size = typeof body?.size === "number" && body.size >= 0 ? body.size : null;
  const mime = text(body?.mime, 120) ?? null;
  if (!fileName) return NextResponse.json({ error: "file_name_required" }, { status: 400 });
  if (size !== null && size > MAX_FILE_BYTES) return NextResponse.json({ error: "too_big" }, { status: 413 });

  if (body?.action === "sign") {
    const path = filePath(auth.tenant_id, design.item_id, design.id, fileName);
    const { data, error } = await supabaseServer.storage.from(BRAND_BUCKET).createSignedUploadUrl(path);
    if (error || !data) {
      console.error("[api/brand-center/files sign]", error?.message);
      return NextResponse.json({ error: "Could not prepare the upload." }, { status: 500 });
    }
    return NextResponse.json({ path, token: data.token, signedUrl: data.signedUrl });
  }

  if (body?.action === "register") {
    const path = text(body.path, 600);
    if (!path || !path.startsWith(prefix)) return NextResponse.json({ error: "bad_path" }, { status: 400 });
    const name = path.slice(prefix.length);
    const { data: found, error } = await supabaseServer.storage.from(BRAND_BUCKET).list(prefix.slice(0, -1), { search: name, limit: 1 });
    if (error || !found?.some((o) => o.name === name)) return NextResponse.json({ error: "file_not_uploaded" }, { status: 400 });
    return record(path, fileName, size, mime);
  }

  return NextResponse.json({ error: "bad_action" }, { status: 400 });
}
