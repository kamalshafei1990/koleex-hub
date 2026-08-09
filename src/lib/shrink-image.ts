/* Make a phone photo small enough to upload, without asking the visitor to.

   A company license photographed on a modern phone is 4000×3000 and 4–6 MB.
   The document only has to be readable, and the upload has a 4 MB ceiling, so
   the alternative to doing this is telling someone their license is "too
   large" and letting them work out what to do about it. That is where a form
   loses people.

   PDFs pass through untouched: they are already the right shape, and a PDF is
   not something we can re-encode responsibly. */

const MAX_EDGE = 2000;
const QUALITY = 0.82;

export async function shrinkImage(file: File, maxBytes: number): Promise<File> {
  if (!file.type.startsWith("image/")) return file;
  if (file.size <= maxBytes && file.type !== "image/png") return file;

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    /* Unreadable as an image — hand it back and let the server decide. It
       sniffs the bytes anyway, so nothing gets through on our say-so. */
    return file;
  }

  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
  const w = Math.max(1, Math.round(bitmap.width * scale));
  const h = Math.max(1, Math.round(bitmap.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    bitmap.close();
    return file;
  }
  /* White underneath: a transparent PNG flattened onto nothing turns black
     in JPEG, and a scan of a document is exactly the kind of file that has
     transparency around the edges. */
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();

  const blob: Blob | null = await new Promise((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", QUALITY),
  );
  if (!blob || blob.size >= file.size) return file;

  const name = file.name.replace(/\.[^.]+$/, "") + ".jpg";
  return new File([blob], name, { type: "image/jpeg", lastModified: file.lastModified });
}
