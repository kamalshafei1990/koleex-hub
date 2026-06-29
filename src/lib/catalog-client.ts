/* ---------------------------------------------------------------------------
   catalog-client — browser-side catalog reading for the "import supplier from
   catalog" flow. Runs entirely in the user's browser so we never ship native
   canvas / OCR into the serverless runtime:

     1. PDF → selectable text (unpdf). Fast; covers text-based catalogs.
     2. If a page has almost no text (scanned/image catalog) → render the
        relevant pages and OCR them (tesseract.js, English + Chinese).

   The combined text is then POSTed to /api/suppliers/import-catalog where the
   AI turns it into a reviewable SupplierDraft. Both heavy libs are dynamically
   imported so they stay out of the main bundle.
   --------------------------------------------------------------------------- */

/** Cover + first few + back cover usually hold the company identity/contacts. */
function pickPages<T>(pages: T[]): number[] {
  const idx = new Set<number>();
  for (let i = 0; i < Math.min(4, pages.length); i++) idx.add(i);
  for (let i = Math.max(0, pages.length - 2); i < pages.length; i++) idx.add(i);
  return [...idx].sort((a, b) => a - b);
}

export interface CoverImage {
  dataUrl: string;
  width: number;
  height: number;
}

/** Convert unpdf's raw pixel buffer (1/3/4 channels) to a PNG data URL. */
function rawToDataUrl(img: { data: Uint8ClampedArray; width: number; height: number; channels: 1 | 3 | 4 }): string | null {
  const { data, width, height, channels } = img;
  if (!width || !height) return null;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  const rgba = new Uint8ClampedArray(width * height * 4);
  if (channels === 4) {
    rgba.set(data.subarray(0, rgba.length));
  } else if (channels === 3) {
    for (let i = 0, j = 0; i < width * height; i++) {
      rgba[j++] = data[i * 3];
      rgba[j++] = data[i * 3 + 1];
      rgba[j++] = data[i * 3 + 2];
      rgba[j++] = 255;
    }
  } else {
    for (let i = 0; i < width * height; i++) {
      const v = data[i];
      rgba[i * 4] = v; rgba[i * 4 + 1] = v; rgba[i * 4 + 2] = v; rgba[i * 4 + 3] = 255;
    }
  }
  ctx.putImageData(new ImageData(rgba, width, height), 0, 0);
  return canvas.toDataURL("image/png");
}

/**
 * Pull the embedded images from the first couple of pages so the user can pick
 * the supplier logo. Tiny icons and enormous full-page photos are filtered out
 * — logos are typically small-to-medium. Returns biggest-first, capped.
 */
export async function extractCoverImages(file: File): Promise<CoverImage[]> {
  try {
    const { getDocumentProxy, extractImages } = await import("unpdf");
    const master = new Uint8Array(await file.arrayBuffer());
    const pdf = await getDocumentProxy(master.slice());
    const pages = Math.min(3, pdf.numPages || 1);
    const out: CoverImage[] = [];
    const seen = new Set<string>();
    for (let p = 1; p <= pages; p++) {
      let imgs: Awaited<ReturnType<typeof extractImages>> = [];
      try {
        imgs = await extractImages(pdf, p);
      } catch {
        continue;
      }
      for (const img of imgs) {
        const { width, height } = img;
        if (width < 24 || height < 24) continue; // icon noise only — keep big images (logos can be large)
        const dataUrl = rawToDataUrl(img);
        if (!dataUrl || seen.has(dataUrl)) continue;
        seen.add(dataUrl);
        out.push({ dataUrl, width, height });
        if (out.length >= 12) break;
      }
      if (out.length >= 12) break;
    }
    // Largest first — the logo is usually one of the more prominent marks.
    return out.sort((a, b) => b.width * b.height - a.width * a.height);
  } catch {
    return [];
  }
}

/**
 * Render the first few pages to PNG data URLs so the user can crop the logo
 * out of the cover — works even when the logo is vector art or a scanned page
 * (which embedded-image extraction can't recover).
 */
export async function renderCoverPages(file: File, count = 2): Promise<string[]> {
  try {
    const { getDocumentProxy, renderPageAsImage } = await import("unpdf");
    const master = new Uint8Array(await file.arrayBuffer());
    const pdf = await getDocumentProxy(master.slice());
    const pages = Math.min(count, pdf.numPages || 1);
    const out: string[] = [];
    for (let p = 1; p <= pages; p++) {
      try {
        const png = await renderPageAsImage(master.slice(), p, { scale: 1.5 });
        const blob = new Blob([png as BlobPart], { type: "image/png" });
        out.push(await new Promise<string>((resolve) => {
          const r = new FileReader();
          r.onload = () => resolve(String(r.result || ""));
          r.readAsDataURL(blob);
        }));
      } catch { /* skip page */ }
    }
    return out.filter(Boolean);
  } catch {
    return [];
  }
}

export interface CatalogReadResult {
  text: string;
  usedOcr: boolean;
  totalPages: number;
}

export async function extractCatalogText(
  file: File,
  onProgress?: (msg: string) => void,
): Promise<CatalogReadResult> {
  const { extractText, getDocumentProxy, renderPageAsImage } = await import("unpdf");
  // pdf.js transfers (and DETACHES) the buffer it's handed, so we keep one
  // pristine master copy and pass a fresh .slice() to every call below —
  // otherwise the second call throws "ArrayBuffer ... is already detached".
  const master = new Uint8Array(await file.arrayBuffer());

  onProgress?.("Reading PDF…");
  const pdf = await getDocumentProxy(master.slice());
  const { totalPages, text } = await extractText(pdf, { mergePages: false });
  const pages: string[] = Array.isArray(text) ? text.map((t) => t ?? "") : [String(text ?? "")];

  const chosen = pickPages(pages);
  const selectable = chosen
    .map((i) => `[page ${i + 1}]\n${(pages[i] || "").trim()}`)
    .join("\n\n");

  // Enough real text → no OCR needed.
  if (selectable.replace(/\[page \d+\]/g, "").replace(/\s/g, "").length > 80) {
    return { text: selectable.slice(0, 20000), usedOcr: false, totalPages };
  }

  // Scanned/image catalog → OCR the cover + a couple of likely contact pages.
  onProgress?.("Scanned catalog — running OCR (first run loads the language model)…");
  const { createWorker } = await import("tesseract.js");
  const worker = await createWorker(["eng", "chi_sim"]);
  try {
    const ocrPages = Array.from(
      new Set([0, 1, Math.max(0, totalPages - 1)].filter((i) => i < totalPages)),
    );
    let ocr = "";
    for (const i of ocrPages) {
      onProgress?.(`OCR page ${i + 1} of ${totalPages}…`);
      const png = await renderPageAsImage(master.slice(), i + 1, { scale: 2 });
      const blob = new Blob([png as BlobPart], { type: "image/png" });
      const { data: r } = await worker.recognize(blob);
      ocr += `\n[page ${i + 1}]\n${r.text || ""}`;
    }
    return { text: ocr.slice(0, 20000), usedOcr: true, totalPages };
  } finally {
    await worker.terminate();
  }
}
