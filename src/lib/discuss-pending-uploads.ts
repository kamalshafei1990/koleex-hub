import "server-only";

/* ---------------------------------------------------------------------------
   discuss-pending-uploads — who uploaded a Discuss object (server only).

   GET /api/discuss/pending-media streams an uploaded-but-unsent Discuss file
   back to its sender. It used to rely on the path being unguessable; now each
   Discuss upload is bound to the uploading account + tenant in
   public.discuss_pending_uploads (migration 20260929_discuss_pending_uploads),
   and the route serves a path only to that account.

   Why a table and not storage.objects.owner / object metadata:
     · both upload routes write with the SERVICE key, which has no JWT subject,
       so storage.objects.owner / owner_id stay NULL;
     · /api/storage/upload could attach server-set `metadata`, but the direct
       path (/api/storage/signed-upload → browser PUT) cannot: the PUT's
       headers belong to the browser, so any metadata on it is the client's
       claim, not ours. The signing moment is the only server-side point where
       the uploader is known for that path — so both routes record it here.

   Every function tolerates the table being missing (migration not applied):
   recordDiscussUpload() is a no-op and lookupDiscussUpload() answers
   "unavailable" so the route can fall back to its previous rule.

   Orphans. An uploaded file whose message is never sent (the failed bubble is
   Deleted, or its outbox entry expires) would sit in the private bucket
   forever. Two ways out, both keyed on this table and both refusing a path
   that ANY message references:
     · discardDiscussUploads() — POST /api/discuss/pending-media/discard, the
       client's best-effort call on Delete / TTL purge; only the uploader's own
       rows;
     · sweepDiscussPendingUploads() — GET /api/cron/discuss-pending-sweep
       (daily): rows older than 8 days; an unreferenced path loses its object,
       every swept row is deleted. This replaces the old opportunistic
       "delete rows > 8 days" prune in recordDiscussUpload(), which dropped
       rows WITHOUT their objects and so hid exactly the orphans to remove.
   --------------------------------------------------------------------------- */

import { supabaseServer } from "@/lib/server/supabase-server";

export const DISCUSS_UPLOAD_BUCKETS = new Set(["discuss-media", "discuss-voice"]);

const TABLE = "discuss_pending_uploads";
/** Outbox TTL (7 days) + a day of slack — past this no client can still send
 *  the message that would use the upload. */
export const DISCUSS_PENDING_ROW_TTL_MS = 8 * 24 * 60 * 60 * 1000;
/** `${Date.now()}_${random base36}.${ext}` — the shape uploadDiscussAttachment
 *  / uploadDiscussVoice create (src/lib/discuss.ts). */
export const DISCUSS_UPLOAD_PATH_RE = /^(\d{12,14})_[a-z0-9]{4,16}\.[a-z0-9]{1,8}$/;
/** Reference lookups start this long before the row was written: the row is
 *  recorded before (direct upload: at signing) or right after the object is
 *  stored, always before the message that uses it. Server clock only. */
const REF_SLACK_MS = 10 * 60 * 1000;

/** PostgREST / Postgres answers meaning "this table does not exist here". */
function isMissingTable(err: { code?: string; message?: string } | null | undefined): boolean {
  if (!err) return false;
  if (err.code === "42P01" || err.code === "PGRST205" || err.code === "PGRST204") return true;
  return /does not exist|could not find the table|schema cache/i.test(err.message ?? "");
}

/**
 * Bind a Discuss object path to its uploader. First writer wins (conflicts
 * are ignored), so a second request for the same path can never rebind it to
 * another account. Best-effort: a failure never fails the upload itself.
 */
export async function recordDiscussUpload(input: {
  bucket: string;
  path: string;
  accountId: string;
  tenantId: string | null | undefined;
}): Promise<void> {
  if (!DISCUSS_UPLOAD_BUCKETS.has(input.bucket) || !input.path || !input.accountId || !input.tenantId) return;
  try {
    const { error } = await supabaseServer
      .from(TABLE)
      .upsert(
        {
          bucket: input.bucket,
          path: input.path,
          account_id: input.accountId,
          tenant_id: input.tenantId,
        },
        { onConflict: "bucket,path", ignoreDuplicates: true },
      );
    if (error && !isMissingTable(error)) {
      console.error("[discuss-pending-uploads] record failed:", error.code ?? error.message);
    }
    /* No pruning here any more: expired rows are the sweep's to-do list
       (sweepDiscussPendingUploads) — deleting them here would orphan their
       objects for good. */
  } catch {
    /* Never let bookkeeping break an upload. */
  }
}

export type DiscussUploadLookup =
  /** The table answered: `owner` is the recorded uploader, or null if none. */
  | { available: true; owner: { accountId: string; tenantId: string } | null }
  /** The table is missing (migration not applied) — caller falls back. */
  | { available: false }
  /** Any other failure — callers must fail closed. */
  | { available: true; owner: null; error: true };

/** Who uploaded `bucket/path`, if the binding table exists. */
export async function lookupDiscussUpload(bucket: string, path: string): Promise<DiscussUploadLookup> {
  try {
    const { data, error } = await supabaseServer
      .from(TABLE)
      .select("account_id, tenant_id")
      .eq("bucket", bucket)
      .eq("path", path)
      .maybeSingle();
    if (error) {
      if (isMissingTable(error)) return { available: false };
      return { available: true, owner: null, error: true };
    }
    const row = data as { account_id?: string; tenant_id?: string } | null;
    if (!row?.account_id || !row.tenant_id) return { available: true, owner: null };
    return { available: true, owner: { accountId: row.account_id, tenantId: row.tenant_id } };
  } catch {
    return { available: true, owner: null, error: true };
  }
}

/* ── Orphan cleanup ───────────────────────────────────────────────────── */

type PendingRow = { bucket: string; path: string; account_id: string; tenant_id: string; created_at: string };

/**
 * Is `bucket/path` the media of any message (any channel, deleted or not)?
 * `null` when the lookup failed — callers must then treat it as referenced
 * and keep the object.
 */
export async function isDiscussPathReferenced(
  bucket: string,
  path: string,
  sinceIso: string,
): Promise<boolean | null> {
  try {
    const containment =
      bucket === "discuss-voice" ? { voice: { path } } : { attachments: [{ file_path: path }] };
    const { data, error } = await supabaseServer
      .from("discuss_messages")
      .select("id")
      .contains("metadata", containment)
      .gte("created_at", sinceIso)
      .limit(1);
    if (error) return null;
    return ((data ?? []) as unknown[]).length > 0;
  } catch {
    return null;
  }
}

function refSince(row: Pick<PendingRow, "created_at">): string {
  const t = Date.parse(row.created_at);
  return new Date((Number.isFinite(t) ? t : 0) - REF_SLACK_MS).toISOString();
}

/** Remove objects from a Discuss bucket. True when storage accepted the call
 *  (an already-missing object is not an error). */
async function removeObjects(bucket: string, paths: string[]): Promise<boolean> {
  if (paths.length === 0) return true;
  try {
    const { error } = await supabaseServer.storage.from(bucket).remove(paths);
    if (error) {
      console.error("[discuss-pending-uploads] storage remove failed:", error.message);
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

async function deleteRows(bucket: string, paths: string[]): Promise<boolean> {
  if (paths.length === 0) return true;
  const { error } = await supabaseServer.from(TABLE).delete().eq("bucket", bucket).in("path", paths);
  return !error;
}

export type DiscussUploadRef = { bucket: string; path: string };

/**
 * The uploader gives up on these uploads (failed bubble Deleted / expired).
 * For each path: the row must exist and belong to `owner` (account AND
 * tenant) and no message may reference it — then the object and the row are
 * deleted. Anything else is silently skipped (no oracle). Returns counts.
 */
export async function discardDiscussUploads(
  owner: { accountId: string; tenantId: string },
  items: DiscussUploadRef[],
): Promise<{ discarded: number; skipped: number; tableMissing?: true }> {
  let discarded = 0;
  let skipped = 0;
  for (const it of items) {
    if (!DISCUSS_UPLOAD_BUCKETS.has(it.bucket) || !DISCUSS_UPLOAD_PATH_RE.test(it.path)) {
      skipped++;
      continue;
    }
    const { data, error } = await supabaseServer
      .from(TABLE)
      .select("bucket, path, account_id, tenant_id, created_at")
      .eq("bucket", it.bucket)
      .eq("path", it.path)
      .maybeSingle();
    if (error) {
      if (isMissingTable(error)) return { discarded, skipped: skipped + 1, tableMissing: true };
      skipped++;
      continue;
    }
    const row = data as PendingRow | null;
    if (!row || row.account_id !== owner.accountId || row.tenant_id !== owner.tenantId) {
      skipped++;
      continue;
    }
    const referenced = await isDiscussPathReferenced(row.bucket, row.path, refSince(row));
    if (referenced !== false) {
      skipped++;
      continue;
    }
    /* Object first: if removing it fails, the row stays for the sweep. */
    if (!(await removeObjects(row.bucket, [row.path]))) {
      skipped++;
      continue;
    }
    await deleteRows(row.bucket, [row.path]);
    discarded++;
  }
  return { discarded, skipped };
}

/**
 * Daily sweep (GET /api/cron/discuss-pending-sweep): every row older than
 * DISCUSS_PENDING_ROW_TTL_MS. A path no message references loses its storage
 * object; a referenced one keeps it (it belongs to that message now). Either
 * way the row goes. A failed lookup / removal keeps the row for the next run.
 */
export async function sweepDiscussPendingUploads(opts: {
  batch?: number;
  maxBatches?: number;
  deadlineMs?: number;
} = {}): Promise<{
  ok: boolean;
  removed: number;
  released: number;
  kept: number;
  tableMissing?: true;
}> {
  const batch = opts.batch ?? 100;
  const maxBatches = opts.maxBatches ?? 10;
  const deadline = Date.now() + (opts.deadlineMs ?? 45_000);
  const cutoff = new Date(Date.now() - DISCUSS_PENDING_ROW_TTL_MS).toISOString();
  let removed = 0;
  let released = 0;
  let kept = 0;
  /* Rows we could not settle this run are skipped by the next page. */
  let afterCreated: string | null = null;
  for (let i = 0; i < maxBatches && Date.now() < deadline; i++) {
    let q = supabaseServer
      .from(TABLE)
      .select("bucket, path, account_id, tenant_id, created_at")
      .lt("created_at", cutoff)
      .order("created_at", { ascending: true })
      .limit(batch);
    if (afterCreated) q = q.gt("created_at", afterCreated);
    const { data, error } = await q;
    if (error) {
      if (isMissingTable(error)) return { ok: true, removed, released, kept, tableMissing: true };
      console.error("[discuss-pending-uploads] sweep select failed:", error.code ?? error.message);
      return { ok: false, removed, released, kept };
    }
    const rows = (data ?? []) as PendingRow[];
    if (rows.length === 0) break;

    /* Reference checks, a few at a time. */
    const verdicts: Array<boolean | null> = new Array(rows.length).fill(null);
    const CONCURRENCY = 8;
    for (let j = 0; j < rows.length; j += CONCURRENCY) {
      const slice = rows.slice(j, j + CONCURRENCY);
      const res = await Promise.all(slice.map((r) => isDiscussPathReferenced(r.bucket, r.path, refSince(r))));
      res.forEach((v, k) => { verdicts[j + k] = v; });
    }

    for (const bucket of DISCUSS_UPLOAD_BUCKETS) {
      const inBucket = rows.map((r, k) => ({ r, v: verdicts[k] })).filter((x) => x.r.bucket === bucket);
      const orphans = inBucket.filter((x) => x.v === false).map((x) => x.r.path);
      const referenced = inBucket.filter((x) => x.v === true).map((x) => x.r.path);
      kept += inBucket.filter((x) => x.v === null).length;
      const objectsGone = await removeObjects(bucket, orphans);
      if (objectsGone && (await deleteRows(bucket, orphans))) removed += orphans.length;
      else kept += orphans.length;
      if (await deleteRows(bucket, referenced)) released += referenced.length;
      else kept += referenced.length;
    }
    if (rows.length < batch) break;
    /* Rows kept (lookup / removal failed) would come back on the next page
       forever — continue AFTER this page instead. */
    afterCreated = rows[rows.length - 1].created_at;
  }
  return { ok: true, removed, released, kept };
}
