import "server-only";

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth } from "@/lib/server/auth";

/* POST /api/storage/signed-url
   Body: { bucket: string, path: string, expiresIn?: number }
   Mints a short-lived signed URL for a private bucket object. Used for
   playing back discuss voice notes without exposing the bucket publicly. */

const PRIVATE_BUCKETS = new Set(["discuss-voice"]);

export async function POST(req: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const { bucket, path, expiresIn } = (await req.json()) as {
    bucket: string;
    path: string;
    expiresIn?: number;
  };

  if (!PRIVATE_BUCKETS.has(bucket)) {
    return NextResponse.json(
      { error: `signed URLs are only issued for private buckets` },
      { status: 400 },
    );
  }

  const ttl = Math.min(Math.max(expiresIn ?? 3600, 60), 86400);

  const { data, error } = await supabaseServer.storage
    .from(bucket)
    .createSignedUrl(path, ttl);
  if (error) {
    console.error("[api/storage/signed-url]", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ signedUrl: data.signedUrl, expiresIn: ttl });
}
