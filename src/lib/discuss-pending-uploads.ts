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
   --------------------------------------------------------------------------- */

import { supabaseServer } from "@/lib/server/supabase-server";

export const DISCUSS_UPLOAD_BUCKETS = new Set(["discuss-media", "discuss-voice"]);

const TABLE = "discuss_pending_uploads";
/** Outbox TTL (7 days) + a day of slack — rows older than this are useless. */
const ROW_TTL_MS = 8 * 24 * 60 * 60 * 1000;

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
    /* Opportunistic pruning: ~1 in 50 uploads clears expired rows. */
    if (!error && Math.random() < 0.02) {
      await supabaseServer
        .from(TABLE)
        .delete()
        .lt("created_at", new Date(Date.now() - ROW_TTL_MS).toISOString());
    }
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
