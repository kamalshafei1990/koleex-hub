"use client";

/* Render a PDF's first page to a JPEG Blob (a cover thumbnail), entirely
   client-side via pdf.js loaded from CDN. Returns null on any failure so the
   caller can fall back gracefully. Mirrors the catalogs page's generator so a
   catalogue uploaded from the Supplier form gets the same first-page cover as
   one uploaded directly in the Catalogs app. */

const PDFJS_CDN = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174";
let pdfjsLoaded = false;

function ensurePdfJs(): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const w = window as any;
  if (pdfjsLoaded && w.pdfjsLib) return Promise.resolve();
  return new Promise((resolve, reject) => {
    if (w.pdfjsLib) { pdfjsLoaded = true; resolve(); return; }
    const script = document.createElement("script");
    script.src = `${PDFJS_CDN}/pdf.min.js`;
    script.onload = () => {
      const lib = w.pdfjsLib;
      if (!lib) { reject(new Error("pdfjsLib not on window")); return; }
      lib.GlobalWorkerOptions.workerSrc = `${PDFJS_CDN}/pdf.worker.min.js`;
      pdfjsLoaded = true;
      resolve();
    };
    script.onerror = () => reject(new Error("Failed to load pdf.js"));
    document.head.appendChild(script);
  });
}

export async function pdfFirstPageCover(file: File): Promise<Blob | null> {
  const timeout = new Promise<null>((resolve) => setTimeout(() => resolve(null), 30000));
  const generate = async (): Promise<Blob | null> => {
    try {
      await ensurePdfJs();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const pdfjsLib = (window as any).pdfjsLib;
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) }).promise;
      const page = await pdf.getPage(1);
      const viewport = page.getViewport({ scale: 0.75 });
      const canvas = document.createElement("canvas");
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      const ctx = canvas.getContext("2d");
      if (!ctx) return null;
      await page.render({ canvasContext: ctx, viewport }).promise;
      return await new Promise<Blob | null>((resolve) => canvas.toBlob((b) => resolve(b), "image/jpeg", 0.85));
    } catch (err) {
      console.error("[pdf-cover]", err);
      return null;
    }
  };
  return Promise.race([generate(), timeout]);
}
