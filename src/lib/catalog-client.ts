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
