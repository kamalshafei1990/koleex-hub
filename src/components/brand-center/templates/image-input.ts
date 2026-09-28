"use client";

/* A picture chosen on this computer, read in the browser and never
   uploaded: photos become a JPEG of at most 2400 px on the long side
   (about 600 dpi on a card's 90 mm), logos and QR images stay PNG (their
   transparency and hard edges), SVG stays as it is. */

const MAX_INPUT = 20 * 1024 * 1024;
const MAX_SIDE = 2400;

export async function readImage(file: File, keep: "photo" | "graphic"): Promise<string | null> {
  if (file.size > MAX_INPUT || !file.type.startsWith("image/")) return null;
  if (file.type === "image/svg+xml") {
    return new Promise((resolve) => {
      const r = new FileReader();
      r.onload = () => resolve(typeof r.result === "string" ? r.result : null);
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
    return keep === "photo" ? canvas.toDataURL("image/jpeg", 0.92) : canvas.toDataURL("image/png");
  } catch {
    return null;
  }
}
