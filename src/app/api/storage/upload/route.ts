import "server-only";

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth } from "@/lib/server/auth";
import { normaliseUploadPath } from "@/lib/server/storage-tenant";

/* POST /api/storage/upload
   Phase S.2 — tenant isolation hardening.

   Uploads to a tenant-scoped bucket are forced under
   `${auth.tenant_id}/...`. If the caller passes a path that's already
   tenant-prefixed for THEIR tenant, it goes through unchanged. If it
   has no prefix, the server prepends one. If it starts with a
   *different* tenant's UUID prefix, the upload is rejected with 403.

   Shared buckets (media, product-images, product-assets) remain
   pass-through — they store cross-tenant assets.
*/

const ALLOWED_BUCKETS = new Set([
  "media",
  "product-images",
  "product-assets",
  "discuss-voice",       // legacy: private, not tenant-scoped at path level
  "finance-documents",   // tenant-scoped (Phase 2.6 + S.2)
]);

export async function POST(req: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const form = await req.formData();
  const file = form.get("file");
  const bucket = form.get("bucket");
  const rawPath = form.get("path");
  const upsert = form.get("upsert") === "true";
  const cacheControl =
    (form.get("cacheControl") as string | null) ?? "3600";
  const contentType =
    (form.get("contentType") as string | null) ?? undefined;

  if (!(file instanceof Blob)) {
    return NextResponse.json(
      { error: "file is required" },
      { status: 400 },
    );
  }
  if (typeof bucket !== "string" || typeof rawPath !== "string" || !bucket || !rawPath) {
    return NextResponse.json(
      { error: "bucket and path are required" },
      { status: 400 },
    );
  }
  if (!ALLOWED_BUCKETS.has(bucket)) {
    return NextResponse.json(
      { error: `bucket '${bucket}' is not allowed` },
      { status: 400 },
    );
  }

  /* Phase S.2 — never trust client-provided path on tenant-scoped buckets. */
  const norm = normaliseUploadPath(bucket, rawPath, auth.tenant_id);
  if (!norm.ok) {
    return NextResponse.json({ error: norm.error }, { status: 403 });
  }
  const path = norm.path;

  const { data, error } = await supabaseServer.storage
    .from(bucket)
    .upload(path, file, { cacheControl, upsert, contentType });

  if (error) {
    console.error("[api/storage/upload]", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const { data: urlData } = supabaseServer.storage
    .from(bucket)
    .getPublicUrl(data.path);

  return NextResponse.json({
    path: data.path,
    publicUrl: urlData.publicUrl,
  });
}
