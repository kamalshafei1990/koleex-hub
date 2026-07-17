import "server-only";

/* ---------------------------------------------------------------------------
   GET /api/files/<category>/<id>[/<index>] — first-party file streaming
   (China remediation R3, private/document delivery foundation).

   Serves storage objects through hub.koleexgroup.com (proven ~99% reachable
   from mainland China) instead of the browser fetching *.supabase.co
   directly (~19% mainland node failure). Identifier-based ONLY: the client
   can never pass a URL or bucket path — every object path is resolved
   server-side from the owning database record, then authorized per record.

   Categories:
     catalog/<catalogId>            → catalogs.file_path      (module-gated)
     discuss/<messageId>/<index>    → message attachment path (membership-gated)

   Security model: docs/performance/STORAGE_SECURITY_MODEL.md. Highlights:
   uniform 404 for missing AND unauthorized (no existence oracle); bucket
   allowlist per category; path-hygiene rejection; MIME allowlist for inline
   rendering (everything else forced to attachment + nosniff); private
   cache semantics; 200MB cap; 50s upstream abort; Range passthrough
   (Catalogs' 32–187MB PDFs depend on range loading — first-party delivery
   makes Accept-Ranges same-origin visible, which the old cross-origin path
   hid); streaming pass-through, never buffering whole files in memory.

   Runtime: Node.js (documented choice) — we need ReadableStream body
   passthrough with full header control plus the server-only service key;
   this is a server credential path and must never run client-adjacent.
   --------------------------------------------------------------------------- */

import { NextResponse } from "next/server";
import { requireAuth, requireModuleAccess, type ServerAuthContext } from "@/lib/server/auth";
import { supabaseServer } from "@/lib/server/supabase-server";
import { stageTimer } from "@/lib/server/perf";
import { discussMediaList } from "@/lib/server/discuss-media";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

const MAX_BYTES = 200 * 1024 * 1024; // 413 above this
const UPSTREAM_TIMEOUT_MS = 50_000;

/** Buckets each category may serve from — anything else is rejected.
 *
 *  `discuss` spans three during the Unit-2 migration window:
 *    · discuss-media  — private, ALL new images/documents
 *    · discuss-voice  — private, ALL new voice notes
 *    · media          — public, LEGACY READ ONLY. Six pre-Unit-2 objects still
 *                       live here. Nothing writes Discuss media to it any more.
 *                       Removed from this list once those six are migrated and
 *                       revoked (Run C) — validate:discuss-attachments then
 *                       asserts it cannot come back. */
const CATEGORY_BUCKETS: Record<string, string[]> = {
  catalog: ["media"],
  discuss: ["discuss-media", "discuss-voice", "media"],
};

/** MIME types allowed to render inline. Everything else (incl. SVG/HTML/XML,
 *  which could execute in our origin) is forced to download. */
const INLINE_MIME = /^(image\/(png|jpe?g|gif|webp|avif)|application\/pdf|audio\/|video\/)/i;

/* ---------------------------------------------------------------------------
   Cache policy — ONE value, applied to EVERY response this route can emit.

   The success path always set `private`. The FAILURE paths did not set anything,
   so Next.js applied its default `public, max-age=0, must-revalidate`. Nothing
   was ever served stale (max-age=0 + must-revalidate), and no user data is in a
   denial body — but `public` on an authorization decision is wrong on its face:
   it tells every shared cache on the path that the response is not
   user-specific, when the whole point of a 401/404 here is that it IS.

   The rule is therefore expressed once, and no response is constructed without
   it. That includes the 401 handed back by requireAuth(), which this route does
   not build itself and so cannot be trusted to carry the right header. */
const CACHE_PRIVATE = "private, max-age=0, must-revalidate";

/** Stamp the cache policy onto any response, including ones built elsewhere
 *  (requireAuth's 401). Always overwrites — a caller that already set a weaker
 *  value is exactly the bug this exists to prevent. */
function withPrivateCache<T extends Response>(res: T): T {
  res.headers.set("Cache-Control", CACHE_PRIVATE);
  return res;
}

const deny = () =>
  withPrivateCache(NextResponse.json({ error: "Not found" }, { status: 404 }));

/** 405 for every non-GET method. Next.js would synthesise its own 405 for a
 *  missing export, but that response is outside our control and would carry the
 *  framework default header — so the methods are declared explicitly. */
const methodNotAllowed = () =>
  withPrivateCache(
    NextResponse.json({ error: "Method not allowed" }, { status: 405, headers: { Allow: "GET, HEAD" } }),
  );

export const POST = methodNotAllowed;
export const PUT = methodNotAllowed;
export const PATCH = methodNotAllowed;
export const DELETE = methodNotAllowed;
export const OPTIONS = methodNotAllowed;

/** Reject traversal / injection shapes even though paths come from our DB. */
function unsafePath(p: string): boolean {
  if (!p || p.length > 1024) return true;
  const lowered = p.toLowerCase();
  return (
    p.startsWith("/") ||
    p.includes("..") ||
    p.includes("\\") ||
    p.includes("//") ||
    lowered.includes("%2e") ||
    lowered.includes("%2f") ||
    lowered.includes("%5c")
  );
}

/** Accept either a bare object path or a full public URL from our own
 *  project, returning the bucket-relative path — anything else is rejected. */
function toObjectPath(raw: string | null | undefined, bucket: string): string | null {
  if (!raw) return null;
  let p = raw.trim();
  if (p.startsWith("http")) {
    try {
      const u = new URL(p);
      if (SUPABASE_URL && u.hostname !== new URL(SUPABASE_URL).hostname) return null;
      const marker = `/storage/v1/object/public/${bucket}/`;
      const i = u.pathname.indexOf(marker);
      if (i === -1) return null;
      p = decodeURIComponent(u.pathname.slice(i + marker.length));
    } catch {
      return null;
    }
  }
  if (p.startsWith(`${bucket}/`)) p = p.slice(bucket.length + 1);
  return unsafePath(p) ? null : p;
}

type Resolved = { bucket: string; path: string; filename: string };

async function resolveCatalog(auth: ServerAuthContext, id: string): Promise<Resolved | null> {
  const denied = await requireModuleAccess(auth, "catalogs");
  if (denied) return null; // uniform 404 upstream — no existence oracle
  /* Tenant isolation (regression fix, R3 file-delivery authz validation): the
     catalogs list route scopes by tenant, so this MUST too — otherwise a user
     in another organization who happens to hold the Catalogs module could
     fetch an Org-A catalog PDF by id. Scope to the caller's tenant exactly
     like GET /api/catalogs does. */
  const { data } = await supabaseServer
    .from("catalogs")
    .select("file_path, file_url, file_name")
    .eq("id", id)
    .eq("tenant_id", auth.tenant_id)
    .maybeSingle();
  if (!data) return null;
  const path = toObjectPath(data.file_path ?? data.file_url, "media");
  if (!path) return null;
  return { bucket: "media", path, filename: data.file_name ?? "file" };
}

/* Authorization chain (Discuss Stabilization Unit 2):
     1. authenticated active account            (caller: requireAuth)
     2. message exists and is not deleted
     3. message's channel belongs to THIS tenant  ← scoped in the query itself
     4. account has ACTIVE membership in that channel
     5. attachment index resolves to a real object
   Every failure returns null → uniform 404 upstream (no existence oracle).

   Tenant scoping is defence-in-depth: membership already implies the channel,
   but we refuse to even fetch a row from another tenant rather than fetch
   broadly and compare afterwards. The `!inner` join + eq makes Postgres do it.
   Fail-closed: a channel with a NULL tenant_id will not match and its media is
   denied. Verified safe at rollout — 2 legacy NULL-tenant channels exist and
   hold 0 attachment/voice messages. */
async function resolveDiscuss(
  auth: ServerAuthContext,
  messageId: string,
  index: number,
): Promise<Resolved | null> {
  const { data: msg } = await supabaseServer
    .from("discuss_messages")
    .select("channel_id, metadata, deleted_at, discuss_channels!inner(tenant_id)")
    .eq("id", messageId)
    .eq("discuss_channels.tenant_id", auth.tenant_id)
    .maybeSingle();
  if (!msg || msg.deleted_at) return null;
  /* Record-level authorization: active membership in the message's channel.
     A user removed from the channel (left_at set) loses access immediately —
     this is what makes an old URL stop working, unlike a signed URL that stays
     valid until it expires. */
  const { data: member } = await supabaseServer
    .from("discuss_members")
    .select("id")
    .eq("channel_id", msg.channel_id)
    .eq("account_id", auth.account_id)
    .is("left_at", null)
    .maybeSingle();
  if (!member) return null;

  /* Bucket AND path come from the server-normalized metadata — never from the
     client, never hardcoded. discussMediaList() is the single place that reads
     the raw location fields and tolerates the legacy public-URL shape; it
     returns an empty path for anything it cannot resolve, which fails closed
     here (uniform 404) WITHOUT shifting the index of any other item. */
  const src = discussMediaList(msg.metadata)[index];
  if (!src || !src.path) return null;
  return { bucket: src.bucket, path: src.path, filename: src.name };
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ ref: string[] }> },
) {
  const timing = stageTimer("files.stream");
  const auth = await requireAuth();
  /* 401 — auth precedes everything. requireAuth() builds this response, so it
     carries the framework's default cache header; re-stamp it here rather than
     trusting a shared helper we don't own to know this route's policy. */
  if (auth instanceof NextResponse) return withPrivateCache(auth);
  timing.mark("auth");

  const { ref } = await params;
  const [category, id, indexRaw] = ref ?? [];
  if (!category || !id || !/^[0-9a-f-]{8,64}$/i.test(id)) return deny();
  if (!CATEGORY_BUCKETS[category]) return deny();

  let resolved: Resolved | null = null;
  if (category === "catalog") {
    resolved = await resolveCatalog(auth, id);
  } else if (category === "discuss") {
    const idx = Number(indexRaw ?? "0");
    if (!Number.isInteger(idx) || idx < 0 || idx > 50) return deny();
    resolved = await resolveDiscuss(auth, id, idx);
  }
  if (!resolved || !CATEGORY_BUCKETS[category].includes(resolved.bucket)) return deny();
  timing.mark("authorize");

  if (!SUPABASE_URL || !SERVICE_KEY) return withPrivateCache(NextResponse.json({ error: "Storage unavailable" }, { status: 503 }));

  /* Fetch with the service key (server-only; never exposed, never redirected
     to). Range is forwarded verbatim so partial PDF loading keeps working. */
  const upstreamHeaders: Record<string, string> = {
    apikey: SERVICE_KEY,
    Authorization: `Bearer ${SERVICE_KEY}`,
  };
  const range = req.headers.get("range");
  if (range && /^bytes=\d*-\d*(,\d*-\d*)*$/.test(range)) upstreamHeaders.Range = range;

  let upstream: Response;
  try {
    upstream = await fetch(
      `${SUPABASE_URL}/storage/v1/object/${resolved.bucket}/${encodeURI(resolved.path)}`,
      { headers: upstreamHeaders, signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS) },
    );
  } catch {
    return withPrivateCache(NextResponse.json({ error: "Upstream timeout" }, { status: 504 }));
  }
  timing.mark("upstream");

  if (upstream.status === 416) return withPrivateCache(new NextResponse(null, { status: 416 }));
  if (!upstream.ok) return deny();

  const size = Number(upstream.headers.get("content-length") ?? "0");
  if (size > MAX_BYTES) return withPrivateCache(NextResponse.json({ error: "File too large" }, { status: 413 }));

  const mime = upstream.headers.get("content-type") ?? "application/octet-stream";
  const inline = INLINE_MIME.test(mime);
  const safeName = resolved.filename.replace(/[^\w. \-()\[\]]+/g, "_").slice(0, 120) || "file";

  const headers = new Headers();
  headers.set("Content-Type", inline ? mime : "application/octet-stream");
  headers.set("Content-Disposition", `${inline && !req.url.includes("download=1") ? "inline" : "attachment"}; filename="${safeName}"`);
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("Cache-Control", CACHE_PRIVATE);
  for (const h of ["content-length", "content-range", "accept-ranges", "etag", "last-modified"]) {
    const v = upstream.headers.get(h);
    if (v) headers.set(h, v);
  }

  const { total } = timing.done({ category, status: upstream.status, bytes: size });
  headers.set("Server-Timing", `total;dur=${total}`);
  /* Privacy-safe access line (Discuss Stabilization Unit 2 hardening): the
     resource id is NOT logged. For `discuss` the id IS the message id, and a
     message id in logs is a conversation-linkable identifier. We keep only
     non-identifying shape — category / bucket / status / bytes / range — which
     is enough to debug delivery without telling anyone WHICH message was read.
     Never log paths, filenames, accounts, channels, or content. */
  console.warn(`[kx-file] ${JSON.stringify({ category, bucket: resolved.bucket, status: upstream.status, bytes: size, range: range ? 1 : 0 })}`);

  /* Stream the body through — the function never holds the whole file. */
  return new NextResponse(upstream.body, { status: upstream.status, headers });
}
