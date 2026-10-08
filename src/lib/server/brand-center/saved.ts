import "server-only";

/* Brand Center — saved templates ("my templates"): the shared checks of
   /api/brand-center/saved. A saved fill never carries pictures (data: URLs
   are dropped here too, whatever the browser sent) and is kept small. */

export const SAVED_MAX_BYTES = 200 * 1024;
export const SAVED_COLUMNS = "id, account_id, template_id, name, fill, shared, created_at, updated_at";

/** The fill without any embedded picture (portraits, QR pictures, logos). */
export function withoutPictures(v: unknown): unknown {
  if (typeof v === "string") return v.startsWith("data:") ? "" : v;
  if (Array.isArray(v)) return v.map(withoutPictures);
  if (v && typeof v === "object") return Object.fromEntries(Object.entries(v as Record<string, unknown>).map(([k, x]) => [k, withoutPictures(x)]));
  return v;
}

export const isTemplateId = (x: unknown): x is string => typeof x === "string" && /^[a-z0-9-]{2,40}$/.test(x);

/** A clean fill: an object, pictures dropped, under the size limit — or null. */
export function cleanFill(x: unknown): Record<string, unknown> | null {
  if (!x || typeof x !== "object" || Array.isArray(x)) return null;
  const clean = withoutPictures(x) as Record<string, unknown>;
  return JSON.stringify(clean).length <= SAVED_MAX_BYTES ? clean : null;
}
