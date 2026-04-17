import "server-only";

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth } from "@/lib/server/auth";

/* POST /api/storage/upload
   multipart/form-data:
     file     (required) — the file blob
     bucket   (required) — storage bucket id
     path     (required) — object path within the bucket
     upsert   (optional) — "true" to replace existing object

   Uses the service_role Supabase client, so anon/authenticated writes
   can be blocked at the storage policy level. Only the bucket whitelist
   below is allowed — tightens the blast radius if an API caller tries
   to write into an unexpected bucket.
*/

const ALLOWED_BUCKETS = new Set([
  "media",
  "product-images",
  "product-assets",
  "discuss-voice", // private bucket for voice notes (see /api/storage/signed-url)
]);

export async function POST(req: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const form = await req.formData();
  const file = form.get("file");
  const bucket = form.get("bucket");
  const path = form.get("path");
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
  if (typeof bucket !== "string" || typeof path !== "string" || !bucket || !path) {
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
