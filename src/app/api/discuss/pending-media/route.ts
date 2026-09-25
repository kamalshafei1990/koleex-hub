import "server-only";

/* ---------------------------------------------------------------------------
   GET /api/discuss/pending-media?c=<channelId>&b=m|v&p=<objectPath>

   Preview of an attachment / voice clip that was UPLOADED but whose message
   never reached the server (a failed send restored from the reload-proof
   outbox, src/lib/discuss-outbox.ts). Such a bubble has no canonical message
   id, so /api/files/discuss/<messageId>/<index> cannot resolve it, and its
   sender-local blob: URL died with the previous page. The object itself is
   already in the private bucket — this streams it back to its uploader.

   Authorization (every failure is the same 404 — no existence oracle):
     1. authenticated account with the Discuss module;
     2. ACTIVE member of channel `c` (the conversation the send targets),
        scoped to the caller's tenant;
     3. `p` has the exact shape Discuss uploads create
        (`<epoch ms>_<random>.<ext>`, uploadDiscussAttachment/uploadDiscussVoice)
        in one of the two private Discuss buckets, and is recent (outbox TTL);
     3b. the path is BOUND TO THE CALLER: public.discuss_pending_uploads
        (written by /api/storage/upload and /api/storage/signed-upload, see
        src/lib/discuss-pending-uploads.ts) records the uploading account and
        tenant, and both must match the caller. No row → 404. Only when the
        table does not exist yet (migration 20260929 not applied) does the
        route fall back to the previous rule, where the unguessable path
        (never sent to any other client — the serializer strips it) was the
        only uploader check;
     4. the object is NOT already the media of a message in another channel.
        Once a message references the path, its canonical first-party route
        (with that channel's membership check) is the only way in — so a
        path cannot be used to read media of a conversation the caller has
        left.
   Same delivery hygiene as /api/files: service-key fetch server-side only,
   Range passthrough (voice seeking), inline only for the safe MIME list,
   nosniff, private no-store-ish cache, never a redirect to storage.
   --------------------------------------------------------------------------- */

import { NextResponse } from "next/server";
import { requireAuth, requireModuleAccess } from "@/lib/server/auth";
import { supabaseServer } from "@/lib/server/supabase-server";
import { lookupDiscussUpload } from "@/lib/discuss-pending-uploads";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SUPABASE_URL = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").trim();
const SERVICE_KEY = (process.env.SUPABASE_SERVICE_ROLE_KEY ?? "").trim();

const BUCKETS: Record<string, string> = { m: "discuss-media", v: "discuss-voice" };
/** `${Date.now()}_${random base36}.${ext}` — see src/lib/discuss.ts. */
const PATH_RE = /^(\d{12,14})_[a-z0-9]{4,16}\.[a-z0-9]{1,8}$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** Outbox TTL (7 days) plus a day of clock slack. */
const MAX_AGE_MS = 8 * 24 * 60 * 60 * 1000;
const MAX_BYTES = 60 * 1024 * 1024;
const UPSTREAM_TIMEOUT_MS = 50_000;
const INLINE_MIME = /^(image\/(png|jpe?g|gif|webp|avif)|application\/pdf|audio\/|video\/)/i;
const CACHE_PRIVATE = "private, max-age=0, must-revalidate";

function withPrivateCache<T extends Response>(res: T): T {
  res.headers.set("Cache-Control", CACHE_PRIVATE);
  return res;
}
const deny = () => withPrivateCache(NextResponse.json({ error: "Not found" }, { status: 404 }));

export async function GET(req: Request) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return withPrivateCache(auth);
  const denied = await requireModuleAccess(auth, "Discuss");
  if (denied) return withPrivateCache(denied);

  const url = new URL(req.url);
  const channelId = url.searchParams.get("c") ?? "";
  const bucket = BUCKETS[url.searchParams.get("b") ?? ""];
  const path = url.searchParams.get("p") ?? "";
  const m = PATH_RE.exec(path);
  if (!bucket || !m || !UUID_RE.test(channelId)) return deny();
  const age = Date.now() - Number(m[1]);
  if (!Number.isFinite(age) || age > MAX_AGE_MS || age < -24 * 60 * 60 * 1000) return deny();

  /* 3b. Bound to the caller (account AND tenant). Fails closed on any lookup
     error; falls back to the previous rule only if the table is missing. */
  const binding = await lookupDiscussUpload(bucket, path);
  if (binding.available) {
    if (!binding.owner) return deny();
    if (binding.owner.accountId !== auth.account_id) return deny();
    if (!auth.tenant_id || binding.owner.tenantId !== auth.tenant_id) return deny();
  }

  /* 2. Active membership of the target conversation, in the caller's tenant. */
  const { data: ch } = await supabaseServer
    .from("discuss_channels")
    .select("id")
    .eq("id", channelId)
    .eq("tenant_id", auth.tenant_id)
    .maybeSingle();
  if (!ch) return deny();
  const { data: member } = await supabaseServer
    .from("discuss_members")
    .select("id")
    .eq("channel_id", channelId)
    .eq("account_id", auth.account_id)
    .is("left_at", null)
    .maybeSingle();
  if (!member) return deny();

  /* 4. Already the media of a message elsewhere → not a pending upload of
     this conversation. Bounded to messages created after the upload. */
  const since = new Date(Number(m[1]) - 60_000).toISOString();
  const containment =
    bucket === "discuss-voice"
      ? { voice: { path } }
      : { attachments: [{ file_path: path }] };
  const { data: refs, error: refErr } = await supabaseServer
    .from("discuss_messages")
    .select("channel_id")
    .contains("metadata", containment)
    .gte("created_at", since)
    .limit(5);
  if (refErr) return deny();
  if (((refs ?? []) as Array<{ channel_id: string }>).some((r) => r.channel_id !== channelId)) return deny();

  if (!SUPABASE_URL || !SERVICE_KEY) {
    return withPrivateCache(NextResponse.json({ error: "Storage unavailable" }, { status: 503 }));
  }
  const upstreamHeaders: Record<string, string> = {
    apikey: SERVICE_KEY,
    Authorization: `Bearer ${SERVICE_KEY}`,
  };
  const range = req.headers.get("range");
  if (range && /^bytes=\d*-\d*(,\d*-\d*)*$/.test(range)) upstreamHeaders.Range = range;

  let upstream: Response;
  try {
    upstream = await fetch(`${SUPABASE_URL}/storage/v1/object/${bucket}/${encodeURI(path)}`, {
      headers: upstreamHeaders,
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    });
  } catch {
    return withPrivateCache(NextResponse.json({ error: "Upstream timeout" }, { status: 504 }));
  }
  if (upstream.status === 416) return withPrivateCache(new NextResponse(null, { status: 416 }));
  if (!upstream.ok) return deny();
  const size = Number(upstream.headers.get("content-length") ?? "0");
  if (size > MAX_BYTES) return withPrivateCache(NextResponse.json({ error: "File too large" }, { status: 413 }));

  const mime = upstream.headers.get("content-type") ?? "application/octet-stream";
  const inline = INLINE_MIME.test(mime);
  const headers = new Headers();
  headers.set("Content-Type", inline ? mime : "application/octet-stream");
  headers.set("Content-Disposition", inline ? "inline" : "attachment");
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("Cache-Control", CACHE_PRIVATE);
  for (const h of ["content-length", "content-range", "accept-ranges", "etag", "last-modified"]) {
    const v = upstream.headers.get(h);
    if (v) headers.set(h, v);
  }
  return new NextResponse(upstream.body, { status: upstream.status, headers });
}
