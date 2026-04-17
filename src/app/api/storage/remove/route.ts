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

/* POST /api/storage/remove
   Body: { bucket: string, paths: string[] }
   Deletes a list of objects via the service_role client. */
export async function POST(req: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const { bucket, paths } = (await req.json()) as {
    bucket: string;
    paths: string[];
  };

  if (!ALLOWED_BUCKETS.has(bucket)) {
    return NextResponse.json(
      { error: `bucket '${bucket}' is not allowed` },
      { status: 400 },
    );
  }
  if (!Array.isArray(paths) || paths.length === 0) {
    return NextResponse.json(
      { error: "paths must be a non-empty array" },
      { status: 400 },
    );
  }

  const { error } = await supabaseServer.storage.from(bucket).remove(paths);
  if (error) {
    console.error("[api/storage/remove]", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
