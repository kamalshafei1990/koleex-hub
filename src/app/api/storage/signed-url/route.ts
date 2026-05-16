import "server-only";

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth } from "@/lib/server/auth";
import {
  PRIVATE_BUCKETS,
  assertTenantPath,
} from "@/lib/server/storage-tenant";

/* POST /api/storage/signed-url
   Body: { bucket: string, path: string, expiresIn?: number }

   Phase S.2 — tenant isolation hardening:
     · Only private buckets are eligible (signed URLs for shared
       buckets defeat the purpose of public buckets).
     · For tenant-scoped buckets (finance-documents) the path must
       start with the caller's tenant_id. Cross-tenant signed URLs
       are rejected with 403 — no enumeration via guessed paths.

   For a finance attachment, callers should use
   GET /api/finance/attachments/[id] which verifies the row's
   tenant ownership before minting the URL. This raw route stays
   useful for service-level work (e.g. voice notes) and is kept
   defensive in case a future code path calls it with a
   user-controlled path. */

export async function POST(req: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const { bucket, path, expiresIn } = (await req.json()) as {
    bucket: string;
    path: string;
    expiresIn?: number;
  };

  if (typeof bucket !== "string" || typeof path !== "string" || !bucket || !path) {
    return NextResponse.json({ error: "bucket and path are required" }, { status: 400 });
  }
  if (!PRIVATE_BUCKETS.has(bucket)) {
    return NextResponse.json(
      { error: `signed URLs are only issued for private buckets` },
      { status: 400 },
    );
  }

  /* Phase S.2 — tenant prefix verification for tenant-scoped buckets. */
  const violation = assertTenantPath(bucket, path, auth.tenant_id);
  if (violation) {
    return NextResponse.json({ error: violation }, { status: 403 });
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
