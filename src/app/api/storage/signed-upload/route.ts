import "server-only";

/* ---------------------------------------------------------------------------
   POST /api/storage/signed-upload — mint a one-shot signed upload URL so the
   BROWSER writes to Supabase Storage directly.

   WHY THIS EXISTS. /api/storage/upload carries the file THROUGH a serverless
   function, and that function's request body is hard-capped at 4.5MB by the
   platform. Anything bigger is killed in flight, after the user has already
   waited — and the response is not JSON, so callers could only report a bare
   failure. A supplier price list, a scanned contract, a product catalogue are
   all routinely larger than that, which made "attach a document" quietly
   impossible for exactly the documents that matter most.

   Here the file never crosses our function: we authorize, decide the path,
   and hand back a short-lived token the browser PUTs the bytes to. The only
   remaining ceiling is the bucket's own file_size_limit — 500MB on `media`,
   20MB on `finance-documents` — which is a real policy rather than an
   accident of the transport.

   Authorization is UNCHANGED and still ours: same session requirement, same
   bucket allowlist, and the same tenant-prefix normalisation, so a caller
   cannot mint a token for another tenant's directory. The token is scoped to
   the ONE path we chose — it is not a general write grant.
   --------------------------------------------------------------------------- */

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth } from "@/lib/server/auth";
import { normaliseUploadPath } from "@/lib/server/storage-tenant";

/** Mirrors /api/storage/upload — the two must never drift, or a bucket
 *  refused by one is reachable through the other. */
const ALLOWED_BUCKETS = new Set([
  "media",
  "product-images",
  "product-assets",
  "discuss-media",
  "discuss-voice",
  "finance-documents",
]);

/** Long enough for a large file on a slow uplink, short enough that a leaked
 *  token is not a standing write grant. */
const UPLOAD_TTL_SECONDS = 60 * 30;

export async function POST(req: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  let body: { bucket?: unknown; path?: unknown };
  try {
    body = (await req.json()) as { bucket?: unknown; path?: unknown };
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const bucket = typeof body.bucket === "string" ? body.bucket : "";
  const rawPath = typeof body.path === "string" ? body.path : "";
  if (!bucket || !rawPath) {
    return NextResponse.json({ error: "bucket and path are required" }, { status: 400 });
  }
  if (!ALLOWED_BUCKETS.has(bucket)) {
    return NextResponse.json({ error: `bucket '${bucket}' is not allowed` }, { status: 400 });
  }

  const norm = normaliseUploadPath(bucket, rawPath, auth.tenant_id);
  if (!norm.ok) return NextResponse.json({ error: norm.error }, { status: 403 });

  const { data, error } = await supabaseServer.storage
    .from(bucket)
    .createSignedUploadUrl(norm.path);
  if (error || !data) {
    console.error("[api/storage/signed-upload]", error?.message);
    return NextResponse.json({ error: "Failed to mint upload URL" }, { status: 500 });
  }

  /* `signedUrl` is a PATH relative to the storage origin, not an absolute URL —
     the client joins it to NEXT_PUBLIC_SUPABASE_URL + /storage/v1. Returning
     the token as well so the caller can rebuild the request if it prefers. */
  return NextResponse.json({
    bucket,
    path: norm.path,
    signedUrl: data.signedUrl,
    token: data.token,
    expiresIn: UPLOAD_TTL_SECONDS,
  });
}
