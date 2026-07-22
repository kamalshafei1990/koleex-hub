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

/** One recognised line with its position in ORIGINAL image pixels — the
    anchor for painting the translation back onto the photo. */
export interface OcrLine {
  text: string;
  bbox: { x0: number; y0: number; x1: number; y1: number };
}

export interface OcrResult {
  text: string;
  /** 0–100 mean confidence, for warning about an unreadable photo. */
  confidence: number;
  /** Real text lines (junk already filtered), for the on-photo overlay. */
  lines: OcrLine[];
}

/* Strip the junk lines OCR produces from graphics and decoration — a stylised
   poster yields lines like "A :", ": |", "y iil il) 3 e N J" from the artwork
   itself. Rules are conservative (the text stays editable, so a wrongly kept
   line is cheap; a wrongly DROPPED line loses information):
     · a line with fewer than 2 letters/digits is decoration, not text;
     · a line that is mostly punctuation is decoration;
     · a line of 3+ tokens where most tokens are single characters is the OCR
       misreading artwork ("3 e N J"), not a sentence or a model code. */
export function keepOcrLine(line: string): boolean {
  if (!line) return true; // keep paragraph breaks
  const substantive = (line.match(/[\p{L}\p{N}]/gu) ?? []).length;
  if (substantive < 2) return false;
  const nonSpace = line.replace(/\s+/g, "").length;
  if (nonSpace - substantive > substantive) return false;
  const tokens = line.split(/\s+/);
  if (tokens.length >= 4) {
    // A CJK "word" IS one character and OCR spaces them apart, so a single
    // CJK char is normal text — only isolated Latin letters/digits count as
    // the artwork-misread signature ("3 e N J").
    const singles = tokens.filter(
      (t) => !/[⺀-鿿぀-ヿ가-힯]/.test(t) && (t.match(/[\p{L}\p{N}]/gu) ?? []).length <= 1,
    ).length;
    if (singles / tokens.length > 0.6) return false;
  }
  return true;
}

export function cleanOcrText(raw: string): string {
  const kept = raw.split("\n").map((l) => l.trim()).filter(keepOcrLine);
  // Collapse the blank runs left behind by dropped lines.
  return kept.join("\n").replace(/\n{3,}/g, "\n\n").trim();
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
    // `blocks: true` asks v7 for the layout tree (block → paragraph → line),
    // which carries the bbox of every recognised line — the anchor points for
    // the on-photo overlay.
    const { data } = await worker.recognize(file, {}, { text: true, blocks: true });
    const text = cleanOcrText((data.text ?? "").trim());
    if (!text) throw new Error("no_text");

    // Flatten the layout tree into junk-filtered lines. Defensive traversal:
    // if a build ever omits blocks, the overlay is skipped and the plain text
    // flow still works.
    const lines: OcrLine[] = [];
    type TLine = { text?: string; bbox?: { x0: number; y0: number; x1: number; y1: number } };
    type TPara = { lines?: TLine[] };
    type TBlock = { paragraphs?: TPara[] };
    const blocks = (data as { blocks?: TBlock[] | null }).blocks ?? [];
    for (const b of blocks) {
      for (const p of b.paragraphs ?? []) {
        for (const l of p.lines ?? []) {
          const lineText = (l.text ?? "").trim();
          if (!lineText || !l.bbox || !keepOcrLine(lineText)) continue;
          lines.push({ text: lineText, bbox: l.bbox });
        }
      }
    }

    return { text, confidence: Math.round(data.confidence ?? 0), lines };
  } catch (e) {
    if (e instanceof Error && e.message === "no_text") throw e;
    throw new Error("ocr_failed");
  } finally {
    // The worker holds the loaded models in memory — always release it.
    await worker.terminate().catch(() => {});
  }
}
