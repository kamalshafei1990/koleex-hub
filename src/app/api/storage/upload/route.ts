import "server-only";

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth } from "@/lib/server/auth";
import { normaliseUploadPath } from "@/lib/server/storage-tenant";
import { checkDiscussUpload, mb } from "@/lib/discuss-upload-policy";

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
  "discuss-media",       // private: Discuss images/documents (Unit 2)
  "discuss-voice",       // private: Discuss voice notes
  "finance-documents",   // tenant-scoped (Phase 2.6 + S.2)
]);

/** Buckets whose contents are private and therefore have NO public URL. We
 *  must not call getPublicUrl() for these: Supabase happily returns a
 *  well-formed string that always 400s, and any caller persisting it would
 *  bake a dead, public-looking URL into message metadata — exactly what
 *  Unit 2 removes. */
const PRIVATE_BUCKETS = new Set(["discuss-media", "discuss-voice", "finance-documents"]);

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

  /* Discuss Stabilization Unit 2 — AUTHORITATIVE size/MIME enforcement.
     The composer's `accept` filter is UX only and trivially bypassed, so the
     verdict that counts is made here, BEFORE the object is written and long
     before a message row could reference it. Same shared policy the client
     uses, so both sides always agree. `file.type` is client-reported, which is
     why the bucket's own allowed_mime_types is kept as a third layer. */
  if (bucket === "discuss-media" || bucket === "discuss-voice") {
    const verdict = checkDiscussUpload(bucket, { size: file.size, type: contentType ?? file.type });
    if (!verdict.ok) {
      const message =
        verdict.reason === "type"
          ? `File type not supported`
          : `File is too large (max ${mb(verdict.max)}MB)`;
      // 415/413 are the honest statuses; the body carries a reason code the
      // client maps to a localized string. Never echo the filename back.
      return NextResponse.json(
        { error: message, reason: verdict.reason },
        { status: verdict.reason === "type" ? 415 : 413 },
      );
    }
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

  /* Private buckets have no public URL — return the path only. Callers store
     the path and fetch through an authorized first-party route. */
  if (PRIVATE_BUCKETS.has(bucket)) {
    return NextResponse.json({ path: data.path, publicUrl: null });
  }

  const { data: urlData } = supabaseServer.storage
    .from(bucket)
    .getPublicUrl(data.path);

  return NextResponse.json({
    path: data.path,
    publicUrl: urlData.publicUrl,
  });
}
