"use client";

/* ---------------------------------------------------------------------------
   storage-client — Thin API-first wrappers around Supabase Storage.

   Every browser-side upload / remove / list that used to call
   `supabase.storage.from(bucket).upload(...)` directly now goes through
   these helpers, which POST to our /api/storage/* routes. The server
   uses the service_role client, so anon writes to storage can be closed
   off at the bucket policy level without breaking the app.

   Public reads still work the usual way — the server returns a
   `publicUrl` on upload so callers don't need to construct it locally.
   --------------------------------------------------------------------------- */

export interface UploadOptions {
  upsert?: boolean;
  cacheControl?: string;
  contentType?: string;
}

export interface UploadResult {
  path: string;
  publicUrl: string;
}

/** Upload a file to a bucket via /api/storage/upload. */
export async function uploadToStorage(
  bucket: string,
  path: string,
  file: Blob | File,
  options: UploadOptions = {},
): Promise<{ ok: true; data: UploadResult } | { ok: false; error: string }> {
  const form = new FormData();
  form.append("file", file);
  form.append("bucket", bucket);
  form.append("path", path);
  if (options.upsert) form.append("upsert", "true");
  if (options.cacheControl) form.append("cacheControl", options.cacheControl);
  if (options.contentType) form.append("contentType", options.contentType);

  const res = await fetch("/api/storage/upload", {
    method: "POST",
    credentials: "include",
    body: form,
  });
  if (res.ok) {
    return { ok: true, data: (await res.json()) as UploadResult };
  }
  const err = await res.json().catch(() => ({ error: "Upload failed" }));
  return {
    ok: false,
    error: (err as { error?: string }).error ?? "Upload failed",
  };
}

/** Remove one or more objects from a bucket via /api/storage/remove. */
export async function removeFromStorage(
  bucket: string,
  paths: string[],
): Promise<{ ok: boolean; error?: string }> {
  if (!paths.length) return { ok: true };
  const res = await fetch("/api/storage/remove", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ bucket, paths }),
  });
  if (res.ok) return { ok: true };
  const err = await res.json().catch(() => ({ error: "Remove failed" }));
  return {
    ok: false,
    error: (err as { error?: string }).error ?? "Remove failed",
  };
}

/** List objects in a bucket folder via /api/storage/list.
 *  Returns the list of objects + the bucket's public URL prefix. */
export async function listStorage(
  bucket: string,
  folder: string,
  opts: { limit?: number } = {},
): Promise<{
  ok: true;
  files: Array<{ name: string; metadata?: unknown; created_at?: string }>;
  baseUrl: string;
} | { ok: false; error: string }> {
  const params = new URLSearchParams({ bucket, folder });
  if (opts.limit) params.set("limit", String(opts.limit));
  const res = await fetch("/api/storage/list?" + params.toString(), {
    credentials: "include",
  });
  if (res.ok) {
    const json = (await res.json()) as {
      files: Array<{ name: string; metadata?: unknown; created_at?: string }>;
      baseUrl: string;
    };
    return { ok: true, files: json.files, baseUrl: json.baseUrl };
  }
  const err = await res.json().catch(() => ({ error: "List failed" }));
  return { ok: false, error: (err as { error?: string }).error ?? "List failed" };
}

/** Mint a short-lived signed URL for a private-bucket object.
 *  Used for playing back discuss voice notes without exposing the bucket. */
export async function getSignedUrl(
  bucket: string,
  path: string,
  expiresIn = 3600,
): Promise<string | null> {
  const res = await fetch("/api/storage/signed-url", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ bucket, path, expiresIn }),
  });
  if (!res.ok) return null;
  const json = (await res.json()) as { signedUrl: string };
  return json.signedUrl;
}

/** Synchronously compute the public URL for a bucket object. Works for
 *  public buckets only; private buckets need getSignedUrl() instead. */
export function publicUrl(bucket: string, path: string): string {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  return `${base}/storage/v1/object/public/${bucket}/${path}`;
}
