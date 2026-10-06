/* ---------------------------------------------------------------------------
   storage-url — the ONE place the public-object URL shape is written.

   Extracted from storage-client.ts (2026-10-06): storage-client is
   "use client", so a server module that only needed the URL string (the
   product-schema fabric photos) broke the production build with
   "Attempted to call publicUrl() from the server". This module is neutral —
   no client/server directive, no dependencies — and safe from both sides.

   The literal path pattern lives here and ONLY here (plus the upload route's
   own response builder); validate-first-party-assets allowlists it so every
   other file must build through publicUrl() instead of hardcoding the host.
   --------------------------------------------------------------------------- */

/** Synchronously compute the public URL for a bucket object. Works for
 *  public buckets only; private buckets need a signed URL instead. */
export function publicUrl(bucket: string, path: string): string {
  const base = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").trim();
  return `${base}/storage/v1/object/public/${bucket}/${path}`;
}
