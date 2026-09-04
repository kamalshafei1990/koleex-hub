/* ---------------------------------------------------------------------------
   ai/image-shrink — a phone photo, made the size a picture needs to be.

   Test round, 2026-09-04: the owner attached a 17 MB PNG straight from the
   camera roll and was told "the limit is 15MB for images"; the same tab was
   then reloaded by the browser for using too much memory. Both are the same
   fact: a photo for the vision model does not need seventeen megabytes.
   The model reads a picture at a couple of thousand pixels on its long
   side; everything above that is bytes to upload, hold in memory and pay
   for, and it is thrown away on arrival.

   So an image is shrunk ON THE DEVICE before it is attached: long side at
   most MAX_EDGE, encoded as JPEG. The size gate then runs on what will
   actually be sent. GIFs are left alone (a canvas would keep one frame),
   and so is anything the browser cannot decode — the original is attached
   and the old gate still applies.

   The planning is pure so the suite can drive it; the pixel work is the
   browser's.
   --------------------------------------------------------------------------- */

/** Longest side after shrinking. Enough for any label, plate or model code
 *  a vision model can read; well above what it is given internally. Was
 *  2048; 1600 on 2026-09-04, when "the AI takes a long time to understand
 *  the photo" — a vision model's input cost grows with the pixels, and a
 *  phone photo at 1600 px still shows a type plate. */
export const MAX_EDGE = 1600;
/** Below this an image is attached as it is — shrinking a small picture
 *  only costs a decode and can make it worse. */
export const SHRINK_ABOVE_BYTES = 1_500_000;
export const JPEG_QUALITY = 0.86;

export type ShrinkPlan = { width: number; height: number; scaled: boolean };

/** Target dimensions: the long side capped at maxEdge, aspect kept,
 *  never upscaled, never below one pixel. Pure. */
export function planShrink(width: number, height: number, maxEdge: number = MAX_EDGE): ShrinkPlan {
  const w = Math.max(1, Math.floor(width));
  const h = Math.max(1, Math.floor(height));
  const long = Math.max(w, h);
  if (long <= maxEdge) return { width: w, height: h, scaled: false };
  const k = maxEdge / long;
  return { width: Math.max(1, Math.round(w * k)), height: Math.max(1, Math.round(h * k)), scaled: true };
}

/** Whether a file should go through the shrink at all: an image, not a GIF,
 *  and big enough to be worth it. Pure. */
export function shouldShrink(file: { type?: string; name?: string; size: number }): boolean {
  const type = (file.type || "").toLowerCase();
  const name = (file.name || "").toLowerCase();
  const isImage = type.startsWith("image/") || /\.(png|jpe?g|webp|heic|heif)$/.test(name);
  if (!isImage) return false;
  if (type === "image/gif" || name.endsWith(".gif")) return false;
  return file.size > SHRINK_ABOVE_BYTES;
}

/** The file name the shrunk picture gets: same stem, .jpg. */
export function shrunkName(name: string): string {
  const stem = name.replace(/\.[^.]+$/, "") || "photo";
  return `${stem}.jpg`;
}

/**
 * Shrink one image file in the browser. Resolves to a smaller JPEG File, or
 * to the ORIGINAL file when shrinking is not worth it, not possible, or
 * would not make it smaller. Never throws.
 */
export async function shrinkImage(file: File): Promise<File> {
  if (!shouldShrink(file) || typeof document === "undefined" || typeof createImageBitmap !== "function") return file;
  let bitmap: ImageBitmap | null = null;
  try {
    bitmap = await createImageBitmap(file);
    const plan = planShrink(bitmap.width, bitmap.height);
    const canvas = document.createElement("canvas");
    canvas.width = plan.width;
    canvas.height = plan.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, plan.width, plan.height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", JPEG_QUALITY));
    if (!blob || blob.size >= file.size) return file;
    return new File([blob], shrunkName(file.name), { type: "image/jpeg", lastModified: file.lastModified });
  } catch {
    return file;
  } finally {
    bitmap?.close?.();
  }
}
