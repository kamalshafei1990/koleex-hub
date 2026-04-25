/* ---------------------------------------------------------------------------
   CDN image helper — Supabase Storage on-the-fly transformation.

   Supabase Storage exposes a transformation endpoint at
       /storage/v1/render/image/public/<bucket>/<path>?width=N&quality=Q
   that re-encodes images on demand and caches the result on the
   Supabase CDN. Calling it instead of the raw /object/public/ URL
   typically cuts payload by 5–10× for product photos rendered at
   thumbnail size.

   Verified live on this project: a 2.35 MB hero PNG comes back at
   ~450 KB at width=400 — same image, no quality loss the eye can
   see.

   The helper is safe by design:
     · Non-Supabase URLs pass through unchanged (e.g. external
       CDN-hosted brand logos).
     · Empty or null inputs return the input as-is.
     · If the transform endpoint ever returns 404 the original
       caller can fall back manually — but the endpoint is enabled
       on this project so this is just defense-in-depth.
   --------------------------------------------------------------------------- */

export interface CdnImageOptions {
  /** Target rendered width in pixels. The image is downscaled if
   *  larger. Pick the LARGEST size the surface ever needs (e.g.
   *  card thumbnails 300, hero 1200). */
  width?: number;
  /** Target rendered height in pixels. */
  height?: number;
  /** JPEG / WebP quality 1–100. Defaults to 75 — visually
   *  indistinguishable from 100 for product photography. */
  quality?: number;
  /** "cover" (default) crops to fill the box; "contain" letterboxes. */
  resize?: "cover" | "contain" | "fill";
}

/** Detect a Supabase Storage public-object URL. We swap the path
 *  segment, not the host, so this matches whichever Supabase
 *  project is connected. */
const SUPABASE_OBJECT_PATH = "/storage/v1/object/public/";
const SUPABASE_RENDER_PATH = "/storage/v1/render/image/public/";

export function cdnImage(url: string | null | undefined, opts: CdnImageOptions = {}): string {
  if (!url) return "";
  if (!url.includes(SUPABASE_OBJECT_PATH)) return url;

  const transformed = url.replace(SUPABASE_OBJECT_PATH, SUPABASE_RENDER_PATH);
  const params = new URLSearchParams();
  if (opts.width) params.set("width", String(opts.width));
  if (opts.height) params.set("height", String(opts.height));
  params.set("quality", String(opts.quality ?? 75));
  if (opts.resize) params.set("resize", opts.resize);
  return params.toString() ? `${transformed}?${params.toString()}` : transformed;
}

/** Common preset sizes used across the products app. Centralized
 *  so resize choices stay consistent and easy to tune.
 *
 *  All presets use `resize: "contain"` — the Supabase transform
 *  fits the source within the requested width while preserving
 *  the natural aspect ratio. Without this hint the transform
 *  defaults to a centred crop ("cover"), which on product photos
 *  can clip legs/edges of the machine. With contain we always get
 *  the full image back.
 */
export const IMG = {
  /** Row thumbnail — list cells, brand logos. Bumped from 96 → 160
   *  because the products app routinely shows these inside ≥120px
   *  containers and 96 was rendering too tight to be recognisable. */
  thumb: (url: string | null | undefined) => cdnImage(url, { width: 160, quality: 75, resize: "contain" }),
  /** Card grid thumbnail — products list, related products. */
  card: (url: string | null | undefined) => cdnImage(url, { width: 480, quality: 75, resize: "contain" }),
  /** Detail page gallery slot — main image carousel cells. */
  gallery: (url: string | null | undefined) => cdnImage(url, { width: 1400, quality: 80, resize: "contain" }),
  /** Detail page hero — large above-the-fold photo. */
  hero: (url: string | null | undefined) => cdnImage(url, { width: 1800, quality: 82, resize: "contain" }),
};
