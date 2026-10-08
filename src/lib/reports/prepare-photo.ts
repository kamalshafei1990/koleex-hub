/* ---------------------------------------------------------------------------
   A report photo, made ready on the phone before it travels (Phase 2C).

   A modern phone photo is 4000 × 3000 and 3–6 MB; the report only needs it
   readable on a screen and on paper. So the browser redraws it once: the
   photo at 2000 px on its long edge (a few hundred KB) and a 480 px preview
   for the reader's grid (~40 KB). Both are JPEG, which also leaves the
   camera's hidden details behind (the location a phone writes into every
   photo is not something a report should carry).

   Decoded through an <img>, which applies the photo's EXIF orientation in
   every current browser, so a portrait shot stays upright. A format the
   browser cannot open (HEIC on a desktop Chrome, say) returns null and the
   composer says so plainly.

   Browser-only (canvas); imported by the composer alone.
   --------------------------------------------------------------------------- */

import { PHOTO_MAX_EDGE, PHOTO_QUALITY, THUMB_MAX_EDGE, THUMB_QUALITY } from "./attachments";

export interface PreparedPhoto { file: File; thumb: Blob | null; width: number; height: number }

function decode(file: File): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    const done = (ok: boolean) => { URL.revokeObjectURL(url); resolve(ok && img.naturalWidth > 0 ? img : null); };
    img.onload = () => done(true);
    img.onerror = () => done(false);
    img.src = url;
  });
}

function draw(img: HTMLImageElement, maxEdge: number, quality: number): Promise<{ blob: Blob; w: number; h: number } | null> {
  const scale = Math.min(1, maxEdge / Math.max(img.naturalWidth, img.naturalHeight));
  const w = Math.max(1, Math.round(img.naturalWidth * scale));
  const h = Math.max(1, Math.round(img.naturalHeight * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return Promise.resolve(null);
  /* White underneath: transparency turns black in a JPEG. */
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(img, 0, 0, w, h);
  return new Promise((resolve) => canvas.toBlob((blob) => resolve(blob ? { blob, w, h } : null), "image/jpeg", quality));
}

export async function preparePhoto(file: File): Promise<PreparedPhoto | null> {
  const img = await decode(file);
  if (!img) return null;
  const full = await draw(img, PHOTO_MAX_EDGE, PHOTO_QUALITY);
  if (!full) return null;
  const thumb = await draw(img, THUMB_MAX_EDGE, THUMB_QUALITY);
  const name = `${(file.name || "photo").replace(/\.[^.]+$/, "") || "photo"}.jpg`;
  return {
    file: new File([full.blob], name, { type: "image/jpeg", lastModified: file.lastModified || Date.now() }),
    thumb: thumb?.blob ?? null,
    width: full.w,
    height: full.h,
  };
}
