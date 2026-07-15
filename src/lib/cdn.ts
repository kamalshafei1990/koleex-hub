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

/* ── China remediation R3, stage 1: first-party image delivery ─────────────
   When ON (default), Supabase public-object URLs are rewritten to our own
   /_next/image optimizer endpoint: the browser only ever talks to
   hub.koleexgroup.com (proven ~99% reachable from mainland China, vs ~19%
   node failure for *.supabase.co). Vercel fetches the original server-side
   (Tokyo<->Tokyo), resizes preserving aspect ratio (same visual result as the
   previous resize:"contain" presets) and edge-caches the output.

   KILL-SWITCH / rollback without code change: set NEXT_PUBLIC_KX_FP_IMAGES=0
   and redeploy — every caller falls back to the previous direct Supabase
   render URLs. Non-Supabase URLs always pass through untouched either way. */
const FIRST_PARTY_IMAGES = process.env.NEXT_PUBLIC_KX_FP_IMAGES !== "0";

/* Must mirror next.config.ts images.deviceSizes + imageSizes. The optimizer
   rejects widths outside its allowlist, so we snap UP to the next allowed
   size (never down — no quality loss). */
const ALLOWED_WIDTHS = [16, 32, 48, 64, 96, 128, 160, 256, 384, 480, 640, 750, 828, 1080, 1200, 1440, 1920, 2048, 3840];
const snapWidth = (w: number) => ALLOWED_WIDTHS.find((x) => x >= w) ?? 3840;
const snapQuality = (q: number) => (q >= 78 ? 78 : 75); // mirrors images.qualities

export function cdnImage(url: string | null | undefined, opts: CdnImageOptions = {}): string {
  if (!url) return "";
  if (!url.includes(SUPABASE_OBJECT_PATH)) return url;

  if (FIRST_PARTY_IMAGES) {
    const w = snapWidth(opts.width ?? 1200);
    const q = snapQuality(opts.quality ?? 75);
    /* height/resize hints are intentionally dropped in this mode: the Next
       optimizer always preserves aspect ratio (contain semantics), which is
       what every IMG preset asked for anyway. */
    return `/_next/image?url=${encodeURIComponent(url)}&w=${w}&q=${q}`;
  }

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
/** China R3 stage 2 — identity images (avatars, contact photos, small logos).
 *  Null-safe passthrough: falsy inputs and non-Supabase URLs (data:, blob:,
 *  external) come back unchanged, so existing conditional-render fallbacks
 *  and initials continue to work exactly as before. Supabase public-object
 *  URLs become first-party /_next/image URLs (one shared 160px variant per
 *  image, so identical avatars never trigger duplicate transformations). */
export function fpAvatar<T extends string | null | undefined>(url: T): string | T {
  return url ? cdnImage(url, { width: 160, quality: 75, resize: "contain" }) : url;
}

export const IMG = {
  /** Row thumbnail — list cells, brand logos. Bumped from 96 → 160
   *  because the products app routinely shows these inside ≥120px
   *  containers and 96 was rendering too tight to be recognisable. */
  thumb: (url: string | null | undefined) => cdnImage(url, { width: 160, quality: 75, resize: "contain" }),
  /** Card grid thumbnail — products list, related products. */
  card: (url: string | null | undefined) => cdnImage(url, { width: 480, quality: 75, resize: "contain" }),
  /** Detail page gallery slot — main image carousel cells. The hero
   *  on `aspect-[5/4]` actually paints at ~960px wide on a 1440px
   *  viewport (~480px on mobile), so 1200×q78 covers retina displays
   *  at 2× without paying for a 1800px PNG that no display ever uses
   *  natively. Cuts hero output bytes ~50% on a heavy PNG source. */
  gallery: (url: string | null | undefined) => cdnImage(url, { width: 1200, quality: 78, resize: "contain" }),
  /** Detail page hero — large above-the-fold photo. */
  hero: (url: string | null | undefined) => cdnImage(url, { width: 1400, quality: 78, resize: "contain" }),
};
