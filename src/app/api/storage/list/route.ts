import "server-only";

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth } from "@/lib/server/auth";

const ALLOWED_BUCKETS = new Set([
  "media",
  "product-images",
  "product-assets",
  "discuss-voice",
]);

/* GET /api/storage/list?bucket=X&folder=Y&limit=500
   Returns storage.objects metadata for files under a folder. */
export async function GET(req: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const url = new URL(req.url);
  const bucket = url.searchParams.get("bucket") ?? "";
  const folder = url.searchParams.get("folder") ?? "";
  const limit = Number(url.searchParams.get("limit") ?? "500");

  if (!ALLOWED_BUCKETS.has(bucket)) {
    return NextResponse.json(
      { error: `bucket '${bucket}' is not allowed` },
      { status: 400 },
    );
  }

  const { data, error } = await supabaseServer.storage
    .from(bucket)
    .list(folder, { limit });
  if (error) {
    console.error("[api/storage/list]", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Pre-compute public URLs so clients don't need to call getPublicUrl.
  const baseUrl = supabaseServer.storage
    .from(bucket)
    .getPublicUrl("")
    .data.publicUrl.replace(/\/$/, "");

  return NextResponse.json({
    files: data ?? [],
    baseUrl,
  });
}
