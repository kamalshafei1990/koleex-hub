/* ---------------------------------------------------------------------------
   marketing/media-prep — readies a picture or a video in the browser before
   it is uploaded for a post.

   Pictures become JPEG (Instagram publishes JPEG only), at most 2048px on the
   long side (Facebook's largest; Instagram shows up to 1440 wide), with a
   white ground under any transparency, and under 8 MB. Their width and height
   travel with them so the composer and the server can check Instagram's
   shapes (4:5 to 1.91:1). Videos (MP4 or MOV, up to 300 MB) go as they are,
   with their size and length read from the file.
   Uploads land in the public `media` bucket under marketing/<tenant>/, where
   Meta fetches them from to publish.
   --------------------------------------------------------------------------- */

import { uploadToStorage } from "@/lib/storage-client";
import { IMAGE_MAX_BYTES, VIDEO_MAX_BYTES, VIDEO_MIMES } from "@/lib/marketing/post-rules";
import type { PostMedia } from "@/lib/marketing/post-types";

const MAX_EDGE = 2048;
const PICTURE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif", "image/gif"];

export type PrepError = "unsupported" | "too_big" | "decode" | "upload";
export class MediaPrepError extends Error {
  constructor(readonly reason: PrepError, message: string) { super(message); }
}

export const isPicture = (f: File) => PICTURE_TYPES.includes(f.type) || /\.(jpe?g|png|webp|heic|heif|gif)$/i.test(f.name);
export const isVideo = (f: File) => (VIDEO_MIMES as readonly string[]).includes(f.type) || /\.(mp4|mov)$/i.test(f.name);

async function decode(file: File): Promise<{ source: CanvasImageSource; width: number; height: number; close: () => void }> {
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    return { source: bitmap, width: bitmap.width, height: bitmap.height, close: () => bitmap.close() };
  } catch {
    const url = URL.createObjectURL(file);
    try {
      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const i = new Image();
        i.onload = () => resolve(i);
        i.onerror = () => reject(new Error("decode"));
        i.src = url;
      });
      return { source: img, width: img.naturalWidth, height: img.naturalHeight, close: () => URL.revokeObjectURL(url) };
    } catch {
      URL.revokeObjectURL(url);
      throw new MediaPrepError("decode", "This picture could not be read.");
    }
  }
}

export async function preparePicture(file: File): Promise<{ blob: Blob; width: number; height: number }> {
  const img = await decode(file);
  try {
    const scale = Math.min(1, MAX_EDGE / Math.max(img.width, img.height));
    const width = Math.max(1, Math.round(img.width * scale));
    const height = Math.max(1, Math.round(img.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new MediaPrepError("decode", "This picture could not be read.");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(img.source, 0, 0, width, height);
    for (const quality of [0.9, 0.82, 0.72, 0.6]) {
      const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", quality));
      if (blob && blob.size <= IMAGE_MAX_BYTES) return { blob, width, height };
    }
    throw new MediaPrepError("too_big", "This picture is too large.");
  } finally {
    img.close();
  }
}

export async function videoInfo(file: File): Promise<{ width: number | null; height: number | null; duration: number | null }> {
  const url = URL.createObjectURL(file);
  try {
    return await new Promise((resolve) => {
      const v = document.createElement("video");
      v.preload = "metadata";
      v.onloadedmetadata = () => resolve({
        width: v.videoWidth || null,
        height: v.videoHeight || null,
        duration: Number.isFinite(v.duration) ? Math.round(v.duration * 10) / 10 : null,
      });
      v.onerror = () => resolve({ width: null, height: null, duration: null });
      v.src = url;
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}

function newPath(prefix: string, ext: string): string {
  const d = new Date();
  const id = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `${prefix}${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}/${id}.${ext}`;
}

/** Ready and upload one file; the post keeps what comes back. */
export async function uploadPostMedia(file: File, prefix: string): Promise<PostMedia> {
  if (isVideo(file)) {
    if (file.size > VIDEO_MAX_BYTES) throw new MediaPrepError("too_big", "This video is too large.");
    const mime = /\.mov$/i.test(file.name) || file.type === "video/quicktime" ? "video/quicktime" : "video/mp4";
    const info = await videoInfo(file);
    const path = newPath(prefix, mime === "video/quicktime" ? "mov" : "mp4");
    const up = await uploadToStorage("media", path, file, { contentType: mime });
    if (!up.ok || !up.data.publicUrl) throw new MediaPrepError("upload", up.ok ? "No public link." : up.error);
    return { kind: "video", url: up.data.publicUrl, path: up.data.path, mime, size: file.size, ...info };
  }
  if (!isPicture(file)) throw new MediaPrepError("unsupported", "This file type cannot be posted.");
  const pic = await preparePicture(file);
  const path = newPath(prefix, "jpg");
  const up = await uploadToStorage("media", path, pic.blob, { contentType: "image/jpeg" });
  if (!up.ok || !up.data.publicUrl) throw new MediaPrepError("upload", up.ok ? "No public link." : up.error);
  return { kind: "image", url: up.data.publicUrl, path: up.data.path, mime: "image/jpeg", size: pic.blob.size, width: pic.width, height: pic.height, duration: null };
}
