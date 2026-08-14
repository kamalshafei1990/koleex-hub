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
  /** NULL for private buckets (finance-documents, hr-documents, discuss-*) —
      they have no public URL and the route returns null by design. This was
      typed `string` and the lie cost a working feature: callers assigned it
      straight into a NOT NULL column and the insert failed at runtime with no
      type error anywhere. Identify a private object by `path` + bucket and
      have the server sign it on read. */
  publicUrl: string | null;
}

/** Bodies at or above this go DIRECT to Storage instead of through our own
 *  function, whose request body the platform hard-caps at 4.5MB. Set below the
 *  cap, not at it: multipart framing adds overhead, so a 4.4MB file is already
 *  over the wire limit. */
const DIRECT_UPLOAD_THRESHOLD = 3.5 * 1024 * 1024;

/**
 * Upload a large file by having the SERVER mint a one-shot signed URL and the
 * BROWSER write the bytes straight to Supabase Storage.
 *
 * This is the only way past the 4.5MB transport ceiling. Authorization is
 * unchanged — /api/storage/signed-upload applies the same session check,
 * bucket allowlist and tenant-prefix normalisation before it will sign
 * anything, and the token it returns is scoped to that ONE path.
 */
async function uploadDirectToStorage(
  bucket: string,
  path: string,
  file: Blob | File,
  options: UploadOptions,
): Promise<{ ok: true; data: UploadResult } | { ok: false; error: string }> {
  let signRes: Response;
  try {
    signRes = await fetch("/api/storage/signed-upload", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bucket, path }),
      signal: AbortSignal.timeout(30_000),
    });
  } catch {
    return { ok: false, error: "Network error preparing upload" };
  }
  if (!signRes.ok) {
    const j = (await signRes.json().catch(() => ({}))) as { error?: string };
    return { ok: false, error: j.error ?? `Could not prepare upload (HTTP ${signRes.status})` };
  }
  const signed = (await signRes.json()) as {
    bucket: string; path: string; signedUrl: string; token: string;
  };

  const base = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/+$/, "") ?? "";
  if (!base) return { ok: false, error: "Storage is not configured" };
  /* signedUrl is a path relative to the storage API root. */
  const target = `${base}/storage/v1${signed.signedUrl}`;

  let putRes: Response;
  try {
    putRes = await fetch(target, {
      method: "PUT",
      headers: {
        ...(options.contentType ? { "Content-Type": options.contentType } : {}),
        ...(options.cacheControl ? { "cache-control": options.cacheControl } : {}),
        ...(options.upsert ? { "x-upsert": "true" } : {}),
      },
      body: file,
      /* No timeout: the whole point is files big enough that a fixed deadline
         would kill a legitimate slow upload. The browser still surfaces a
         genuine network failure through the catch below. */
    });
  } catch {
    return { ok: false, error: "Network error during upload" };
  }
  if (!putRes.ok) {
    const j = (await putRes.json().catch(() => ({}))) as { message?: string; error?: string };
    return { ok: false, error: j.message ?? j.error ?? `Upload failed (HTTP ${putRes.status})` };
  }

  /* Mirror /api/storage/upload's contract exactly, including publicUrl: null
     for private buckets — callers must not have to know which route ran. */
  const isPrivate = bucket === "finance-documents" || bucket === "hr-documents"
    || bucket === "discuss-media" || bucket === "discuss-voice";
  return {
    ok: true,
    data: {
      path: signed.path,
      publicUrl: isPrivate ? null : `${base}/storage/v1/object/public/${bucket}/${signed.path}`,
    },
  };
}

/**
 * Upload a file to a bucket.
 *
 * Small files go through /api/storage/upload; anything near the platform's
 * 4.5MB request-body cap is routed DIRECT to Storage instead, because that cap
 * used to kill large uploads mid-flight with a non-JSON response that callers
 * could only report as a generic failure. Both paths return the same shape.
 */
export async function uploadToStorage(
  bucket: string,
  path: string,
  file: Blob | File,
  options: UploadOptions = {},
): Promise<{ ok: true; data: UploadResult } | { ok: false; error: string }> {
  /* RETRY A DROPPED CONNECTION, DON'T HAND IT TO THE USER. "Network error
     during upload" is a thrown fetch, not a refusal — the request never got an
     answer. On a long route (the Hub is used from Shanghai; the bytes cross to
     a serverless function and on to Storage) a single dropped connection is
     ordinary, and asking a person to re-pick the file for it is not. Two extra
     attempts with a short backoff. Only transport failures are retried: an
     HTTP answer, however unwelcome, is a decision and gets reported as-is. */
  let lastError = "Upload failed";
  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt > 0) await new Promise((r) => setTimeout(r, attempt * 800));
    const res = await uploadOnce(bucket, path, file, options);
    if (res.ok) return res;
    lastError = res.error;
    if (!res.retryable) return { ok: false, error: res.error };
  }
  return { ok: false, error: `${lastError} — after 3 attempts.` };
}

async function uploadOnce(
  bucket: string,
  path: string,
  file: Blob | File,
  options: UploadOptions,
): Promise<{ ok: true; data: UploadResult } | { ok: false; error: string; retryable: boolean }> {
  if (file.size >= DIRECT_UPLOAD_THRESHOLD) {
    const direct = await uploadDirectToStorage(bucket, path, file, options);
    return direct.ok ? direct : { ...direct, retryable: direct.error.startsWith("Network error") };
  }

  const form = new FormData();
  form.append("file", file);
  form.append("bucket", bucket);
  form.append("path", path);
  if (options.upsert) form.append("upsert", "true");
  if (options.cacheControl) form.append("cacheControl", options.cacheControl);
  if (options.contentType) form.append("contentType", options.contentType);

  /* Hard timeout: a stalled socket on a bad network used to keep callers in
     "Uploading…" forever with no resolution — the promise simply never
     settled. 90s is generous for a ≤4MB body on a slow uplink; past that the
     upload is dead and the user deserves the failure toast + retry. */
  let res: Response;
  try {
    res = await fetch("/api/storage/upload", {
      method: "POST",
      credentials: "include",
      body: form,
      signal: AbortSignal.timeout(90_000),
    });
  } catch (e) {
    const timedOut = e instanceof DOMException && e.name === "TimeoutError";
    return {
      ok: false,
      error: timedOut ? "Upload timed out" : "Network error during upload",
      retryable: true,
    };
  }
  if (res.ok) {
    return { ok: true, data: (await res.json()) as UploadResult };
  }
  const err = await res.json().catch(() => ({ error: "Upload failed" }));
  return {
    ok: false,
    error: (err as { error?: string }).error ?? "Upload failed",
    /* An HTTP answer is a decision — a 415 or a 413 will not change on a
       retry. Only a 5xx is worth another attempt. */
    retryable: res.status >= 500,
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
  const base = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").trim();
  return `${base}/storage/v1/object/public/${bucket}/${path}`;
}
