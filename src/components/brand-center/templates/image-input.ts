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

/** What a photo was shot on, read from its border: see-through (a cut-out),
 *  white, black, or a scene (a photo with its own background). A post uses
 *  it to melt the photo into its ground or set it on a panel. */
export type PhotoGround = "white" | "black" | "cutout" | "scene";

function groundOf(img: ImageBitmap): PhotoGround | null {
  const s = 64;
  const canvas = document.createElement("canvas");
  canvas.width = s; canvas.height = s;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;
  ctx.drawImage(img, 0, 0, s, s);
  const { data } = ctx.getImageData(0, 0, s, s);
  let n = 0, clear = 0, light = 0, dark = 0;
  for (let i = 0; i < s; i++) {
    for (const [x, y] of [[i, 0], [i, s - 1], [0, i], [s - 1, i]]) {
      const k = (y * s + x) * 4;
      n++;
      if (data[k + 3] < 200) { clear++; continue; }
      const l = (data[k] + data[k + 1] + data[k + 2]) / 3;
      if (l > 232) light++; else if (l < 28) dark++;
    }
  }
  if (clear > n * 0.5) return "cutout";
  if (light > n * 0.7) return "white";
  if (dark > n * 0.7) return "black";
  return "scene";
}

/** A post's photo made ready once: what it was shot on, and — when it is
 *  larger than a post needs — a copy of at most `maxSide` pixels kept in
 *  this browser (a blob: address), so the studio does not decode a
 *  catalogue original of 3,500 px for every thumbnail. Fetched, not an
 *  <img>: a picture the page already shows without CORS would come back
 *  from the image cache tainted. */
const prepared = new Map<string, { url: string; ground: PhotoGround }>();
export async function preparePhoto(url: string, maxSide = 1600): Promise<{ url: string; ground: PhotoGround } | null> {
  const hit = prepared.get(url);
  if (hit) return hit;
  try {
    const res = await fetch(url, { mode: "cors", credentials: "omit" });
    if (!res.ok) return null;
    const bmp = await createImageBitmap(await res.blob());
    const ground = groundOf(bmp);
    if (!ground) { bmp.close(); return null; }
    let out = url;
    const long = Math.max(bmp.width, bmp.height);
    if (long > maxSide) {
      const k = maxSide / long;
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(bmp.width * k);
      canvas.height = Math.round(bmp.height * k);
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.imageSmoothingQuality = "high";
        ctx.drawImage(bmp, 0, 0, canvas.width, canvas.height);
        const small = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, ground === "cutout" ? "image/png" : "image/jpeg", 0.92));
        if (small) out = URL.createObjectURL(small);
      }
    }
    bmp.close();
    const got = { url: out, ground };
    if (prepared.size > 40) prepared.clear();
    prepared.set(url, got);
    prepared.set(out, got);
    return got;
  } catch {
    return null;
  }
}
