"use client";

/* ---------------------------------------------------------------------------
   Image translation — OCR in the BROWSER, then translate the text.

   Same trade as document translation: the photo never leaves the device, only
   the recognised text does. tesseract.js is already a dependency (the scanned
   supplier-catalogue importer uses it) and is imported dynamically, so the
   ~2 MB engine only downloads for someone who actually opens this tab.

   Language choice matters more than it looks: Tesseract is markedly more
   accurate when told which script to expect, and loading every model would
   cost tens of megabytes. We load English plus whichever of Chinese/Arabic the
   source language implies — which covers the three languages Koleex's own
   paperwork is actually written in.
   --------------------------------------------------------------------------- */

export const IMG_ACCEPT = "image/png,image/jpeg,image/webp,image/gif,image/bmp";
export const IMG_MAX_BYTES = 12_000_000; // 12 MB — a phone photo of a spec plate

/** Map a translator source language to the Tesseract models worth loading. */
export function ocrLangsFor(sourceLang: string): string[] {
  switch (sourceLang) {
    case "zh":            return ["chi_sim", "eng"];
    case "ar": case "ur": return ["ara", "eng"];
    case "ja":            return ["jpn", "eng"];
    case "ko":            return ["kor", "eng"];
    case "ru":            return ["rus", "eng"];
    /* "auto" included: Chinese is by far the most common non-English script in
       Koleex's incoming paperwork, and a second model is cheap next to being
       unable to read the page at all. */
    default:              return ["eng", "chi_sim"];
  }
}

export interface OcrResult {
  text: string;
  /** 0–100 mean confidence, for warning about an unreadable photo. */
  confidence: number;
}

/**
 * Recognise text in an image file.
 * Throws "too_large" | "unsupported_type" | "no_text" | "ocr_failed".
 */
export async function recognizeImage(
  file: File,
  sourceLang: string,
  onProgress?: (pct: number) => void,
): Promise<OcrResult> {
  if (!file.type.startsWith("image/")) throw new Error("unsupported_type");
  if (file.size > IMG_MAX_BYTES) throw new Error("too_large");

  const { createWorker } = await import("tesseract.js");

  let worker: Awaited<ReturnType<typeof createWorker>>;
  try {
    worker = await createWorker(ocrLangsFor(sourceLang), undefined, {
      // Tesseract reports 0→1 across load + recognise; surface it as a percent
      // so the user sees the first (slow, one-time) model download move.
      logger: onProgress ? (m) => onProgress(Math.round((m.progress ?? 0) * 100)) : undefined,
    });
  } catch {
    throw new Error("ocr_failed");
  }

  try {
    const { data } = await worker.recognize(file);
    const text = (data.text ?? "").trim();
    if (!text) throw new Error("no_text");
    return { text, confidence: Math.round(data.confidence ?? 0) };
  } catch (e) {
    if (e instanceof Error && e.message === "no_text") throw e;
    throw new Error("ocr_failed");
  } finally {
    // The worker holds the loaded models in memory — always release it.
    await worker.terminate().catch(() => {});
  }
}
