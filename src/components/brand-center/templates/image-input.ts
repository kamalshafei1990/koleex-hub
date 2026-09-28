"use client";

/* A picture chosen on this computer, read in the browser and never
   uploaded: photos become a JPEG of at most 2400 px on the long side
   (about 600 dpi on a card's 90 mm) unless it is a cut-out, logos and QR
   images stay PNG (their transparency and hard edges), SVG stays as is. */

const MAX_INPUT = 20 * 1024 * 1024;
const MAX_SIDE = 2400;

export interface ReadImage { url: string; transparent: boolean }

export async function readImage(file: File, keep: "photo" | "graphic"): Promise<ReadImage | null> {
  if (file.size > MAX_INPUT || !file.type.startsWith("image/")) return null;
  if (file.type === "image/svg+xml") {
    return new Promise((resolve) => {
      const r = new FileReader();
      r.onload = () => resolve(typeof r.result === "string" ? { url: r.result, transparent: true } : null);
      r.onerror = () => resolve(null);
      r.readAsDataURL(file);
    });
  }
  try {
    const bmp = await createImageBitmap(file);
    const scale = Math.min(1, MAX_SIDE / Math.max(bmp.width, bmp.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bmp.width * scale);
    canvas.height = Math.round(bmp.height * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(bmp, 0, 0, canvas.width, canvas.height);
    bmp.close();
    /* A cut-out (transparent background) stays PNG: as JPEG its background
       would turn solid and hide the X stroke behind the person. */
    const transparent = file.type !== "image/jpeg" && hasTransparency(ctx, canvas.width, canvas.height);
    const url = keep === "photo" && !transparent ? canvas.toDataURL("image/jpeg", 0.92) : canvas.toDataURL("image/png");
    return { url, transparent };
  } catch {
    return null;
  }
}

/** Any clearly see-through pixel, sampled on a grid. */
function hasTransparency(ctx: CanvasRenderingContext2D, w: number, h: number): boolean {
  const step = Math.max(1, Math.floor(Math.min(w, h) / 64));
  const { data } = ctx.getImageData(0, 0, w, h);
  for (let y = 0; y < h; y += step) for (let x = 0; x < w; x += step) if (data[(y * w + x) * 4 + 3] < 200) return true;
  return false;
}
