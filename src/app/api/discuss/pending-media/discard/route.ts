import "server-only";

/* ---------------------------------------------------------------------------
   POST /api/discuss/pending-media/discard   body: [{ bucket, path }, …]

   The sender gave up on a failed send whose files were already uploaded (the
   "Not sent" bubble was Deleted, or its outbox entry expired). Without this
   the objects stay in the private Discuss buckets forever: no message will
   ever reference them.

   Deletes ONLY objects that:
     · are recorded in public.discuss_pending_uploads as uploaded by the
       caller (account AND tenant) — src/lib/discuss-pending-uploads.ts;
     · are not referenced by ANY message (any channel, deleted or not);
   then deletes the row. Everything else is skipped without saying why (same
   answer for "not yours", "no such path" and "in use" — no oracle). Called
   best-effort by the client (discuss-outbox.ts); the daily sweep
   (/api/cron/discuss-pending-sweep) catches whatever this misses.
   --------------------------------------------------------------------------- */

import { NextResponse } from "next/server";
import { requireAuth, requireModuleAccess } from "@/lib/server/auth";
import {
  DISCUSS_UPLOAD_BUCKETS,
  DISCUSS_UPLOAD_PATH_RE,
  discardDiscussUploads,
  type DiscussUploadRef,
} from "@/lib/discuss-pending-uploads";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** One failed send carries at most a handful of files; a TTL purge a few
 *  sends. Anything bigger is not a legitimate client call. */
const MAX_ITEMS = 40;
const NO_STORE = { "Cache-Control": "no-store" };

export async function POST(req: Request) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const denied = await requireModuleAccess(auth, "Discuss");
  if (denied) return denied;
  if (!auth.tenant_id) return NextResponse.json({ ok: true, discarded: 0 }, { headers: NO_STORE });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400, headers: NO_STORE });
  }
  if (!Array.isArray(body) || body.length > MAX_ITEMS) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400, headers: NO_STORE });
  }
  const seen = new Set<string>();
  const items: DiscussUploadRef[] = [];
  for (const raw of body as unknown[]) {
    const r = raw as { bucket?: unknown; path?: unknown } | null;
    const bucket = typeof r?.bucket === "string" ? r.bucket : "";
    const path = typeof r?.path === "string" ? r.path : "";
    if (!DISCUSS_UPLOAD_BUCKETS.has(bucket) || !DISCUSS_UPLOAD_PATH_RE.test(path)) continue;
    const key = `${bucket}/${path}`;
    if (seen.has(key)) continue;
    seen.add(key);
    items.push({ bucket, path });
  }
  if (items.length === 0) return NextResponse.json({ ok: true, discarded: 0 }, { headers: NO_STORE });

  const res = await discardDiscussUploads({ accountId: auth.account_id, tenantId: auth.tenant_id }, items);
  return NextResponse.json({ ok: true, discarded: res.discarded }, { headers: NO_STORE });
}
