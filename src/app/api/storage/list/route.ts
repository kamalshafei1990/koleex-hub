import "server-only";

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth } from "@/lib/server/auth";
import { assertTenantPath, isTenantScoped } from "@/lib/server/storage-tenant";

const ALLOWED_BUCKETS = new Set([
  "media",
  "product-images",
  "product-assets",
  "discuss-voice",
  "finance-documents",
]);

/* GET /api/storage/list?bucket=X&folder=Y&limit=500
   Phase S.2 — for tenant-scoped buckets the folder must be the
   caller's tenant_id (or a path under it); empty folder rewrites to
   the caller's tenant prefix so a "list everything" request only
   ever sees the caller's own files. */
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

  let effectiveFolder = folder;
  if (isTenantScoped(bucket)) {
    if (!effectiveFolder) {
      effectiveFolder = auth.tenant_id;
    } else {
      const violation = assertTenantPath(bucket, effectiveFolder, auth.tenant_id);
      if (violation) {
        return NextResponse.json({ error: violation }, { status: 403 });
      }
    }
  }

  const { data, error } = await supabaseServer.storage
    .from(bucket)
    .list(effectiveFolder, { limit });
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
