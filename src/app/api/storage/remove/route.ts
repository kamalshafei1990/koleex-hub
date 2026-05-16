import "server-only";

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth } from "@/lib/server/auth";
import { assertTenantPath } from "@/lib/server/storage-tenant";

/* POST /api/storage/remove
   Body: { bucket: string, paths: string[] }
   Phase S.2 — every path must belong to the caller's tenant when the
   bucket is tenant-scoped. Cross-tenant deletes are rejected as 403. */

const ALLOWED_BUCKETS = new Set([
  "media",
  "product-images",
  "product-assets",
  "discuss-voice",
  "finance-documents",
]);

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

  /* Phase S.2 — reject any path that's not under the caller's tenant
     prefix when the bucket is tenant-scoped. We fail the whole batch
     so an attacker can't smuggle one cross-tenant path among legitimate
     ones and have the rest silently succeed. */
  for (const p of paths) {
    if (typeof p !== "string" || !p) {
      return NextResponse.json({ error: "every path must be a non-empty string" }, { status: 400 });
    }
    const violation = assertTenantPath(bucket, p, auth.tenant_id);
    if (violation) {
      return NextResponse.json({ error: violation }, { status: 403 });
    }
  }

  const { error } = await supabaseServer.storage.from(bucket).remove(paths);
  if (error) {
    console.error("[api/storage/remove]", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
