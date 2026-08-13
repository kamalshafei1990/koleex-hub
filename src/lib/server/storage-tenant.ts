/* ===========================================================================
   storage-tenant — Phase S.2 tenant isolation helpers for Supabase storage.

   Two job categories:

     1. Mark which buckets must be tenant-scoped at the path level
        (private buckets that store per-tenant data).
     2. Provide assertions that reject any path not under the caller's
        tenant prefix.

   The only trusted tenant source is auth.tenant_id. Every path coming
   from the client is treated as untrusted and either rejected (for
   reads/deletes/signed URLs) or rewritten (for uploads) so it lands
   under the tenant's directory.

   Keeping shared / public buckets (media, product-images, product-assets)
   outside this enforcement so they continue to serve cross-tenant
   shared assets correctly.
   ========================================================================== */

/** Buckets that store tenant-scoped data — every object must live under
 *  a `${tenant_id}/...` prefix. */
export const TENANT_SCOPED_BUCKETS = new Set<string>([
  "finance-documents",
  /* Leave attachments are medical certificates and similar — private and
     tenant-prefixed, never a public bucket. */
  "hr-documents",
]);

/** Buckets that are private (require signed URLs) but not necessarily
 *  tenant-scoped (e.g. legacy discuss-voice). */
export const PRIVATE_BUCKETS = new Set<string>([
  "discuss-voice",
  "finance-documents",
  "hr-documents",
]);

export function isTenantScoped(bucket: string): boolean {
  return TENANT_SCOPED_BUCKETS.has(bucket);
}

/* ---------------------------------------------------------------------------
   Private objects have NO public URL — /api/storage/upload deliberately
   returns `publicUrl: null` for them. But rows that reference a stored object
   still need a non-empty `file_url` (the column is NOT NULL), so a private
   object is recorded by this internal URI instead:

       storage://finance-documents/<tenant>/suppliers/<id>/docs/<uuid>.pdf

   It is a REFERENCE, never a link. Read paths that can sign (the Supplier 360
   GET) replace it with a short-lived signed URL built from storage_path; read
   paths that cannot must treat it as "no link" via isPrivateObjectUri() rather
   than handing it to an <a href>. The scheme is chosen so a leak is inert and
   obvious — a browser cannot follow it, and it can never be mistaken for the
   dead-but-plausible public URL that getPublicUrl() would have produced.
   --------------------------------------------------------------------------- */

export const PRIVATE_OBJECT_URI_SCHEME = "storage://";

export function privateObjectUri(bucket: string, path: string): string {
  return `${PRIVATE_OBJECT_URI_SCHEME}${bucket}/${path.replace(/^\/+/, "")}`;
}

/** True for the internal reference above — i.e. "this row points at a private
 *  object and the caller has not signed it". Never renderable. */
export function isPrivateObjectUri(url: string | null | undefined): boolean {
  return typeof url === "string" && url.startsWith(PRIVATE_OBJECT_URI_SCHEME);
}

/** Returns true when `path` is rooted under the given tenant prefix.
 *  Comparison is exact on the leading segment — `t1234abc.../...` will
 *  NOT match tenant `t1234`. */
export function pathBelongsToTenant(path: string, tenantId: string): boolean {
  if (!tenantId) return false;
  const prefix = `${tenantId}/`;
  return path === tenantId || path.startsWith(prefix);
}

/** Throws a structured 403 if the path is not under the caller's
 *  tenant prefix on a tenant-scoped bucket. Returns the path unchanged
 *  on shared buckets. */
export function assertTenantPath(bucket: string, path: string, tenantId: string): string | null {
  if (!isTenantScoped(bucket)) return null;
  if (!pathBelongsToTenant(path, tenantId)) {
    return `cross-tenant storage path rejected: '${path}'`;
  }
  return null;
}

/** For uploads: ensure the path lands under the caller's tenant prefix.
 *  · If it already does, return as-is.
 *  · If it starts with a *different* tenant prefix (caller trying to
 *    write into another tenant's directory), reject — return null + error.
 *  · If it has no tenant prefix at all, prepend the caller's.
 *  Shared buckets are pass-through. */
export function normaliseUploadPath(
  bucket: string,
  path: string,
  tenantId: string,
): { ok: true; path: string } | { ok: false; error: string } {
  if (!isTenantScoped(bucket)) return { ok: true, path };

  if (pathBelongsToTenant(path, tenantId)) {
    return { ok: true, path };
  }

  /* Detect an attacker trying to slip another tenant's UUID prefix. */
  const firstSegment = path.split("/")[0] ?? "";
  const looksLikeUuid = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(firstSegment);
  if (looksLikeUuid && firstSegment !== tenantId) {
    return { ok: false, error: "path attempts a different tenant prefix" };
  }

  /* Otherwise prepend the caller's tenant prefix. */
  return { ok: true, path: `${tenantId}/${path.replace(/^\/+/, "")}` };
}
