"use client";

/* ---------------------------------------------------------------------------
   Document translation — read a file in the BROWSER, translate it in chunks.

   Why client-side extraction: the file never leaves the device except as plain
   text, so a 30 MB supplier catalogue doesn't get uploaded, there's no storage
   bucket to manage, and no request-body limit to hit. `unpdf` is imported
   dynamically (same as the supplier-catalogue importer) so the PDF engine stays
   out of the main bundle for the 99% of visits that only translate text.

   Why chunking: the translate endpoint caps a request at 5,000 characters and
   models degrade on very long inputs anyway. Splitting on paragraph boundaries
   (never mid-sentence) keeps each request coherent, lets the UI show real
   progress, and means one failed chunk doesn't lose the whole document.
   --------------------------------------------------------------------------- */

export const DOC_CHUNK_CHARS = 3_500;
export const DOC_MAX_CHARS = 120_000;   // ~60 pages of dense text
export const DOC_ACCEPT = ".pdf,.txt,.md,.csv";

export interface ExtractedDoc {
  text: string;
  pages: number | null;
  truncated: boolean;
}

/** Pull plain text out of a supported file. Throws with a readable message. */
export async function extractDocumentText(file: File): Promise<ExtractedDoc> {
  const name = file.name.toLowerCase();

  if (name.endsWith(".pdf")) {
    const { extractText, getDocumentProxy } = await import("unpdf");
    const buf = await file.arrayBuffer();
    const pdf = await getDocumentProxy(new Uint8Array(buf));
    const { totalPages, text } = await extractText(pdf, { mergePages: true });
    const merged = Array.isArray(text) ? text.join("\n\n") : String(text ?? "");
    if (!merged.trim()) {
      // Scanned catalogues are images — there is no text layer to translate.
      throw new Error("no_text_layer");
    }
    return {
      text: merged.slice(0, DOC_MAX_CHARS),
      pages: totalPages ?? null,
      truncated: merged.length > DOC_MAX_CHARS,
    };
  }

  if (/\.(txt|md|csv)$/.test(name)) {
    const raw = await file.text();
    if (!raw.trim()) throw new Error("empty_file");
    return { text: raw.slice(0, DOC_MAX_CHARS), pages: null, truncated: raw.length > DOC_MAX_CHARS };
  }

  throw new Error("unsupported_type");
}

/**
 * Split text into translatable chunks on paragraph boundaries, falling back to
 * sentence then hard-cut for pathological input (a single 10k-character line).
 * Never splits mid-sentence when it can avoid it.
 */
export function chunkText(text: string, limit = DOC_CHUNK_CHARS): string[] {
  const paragraphs = text.split(/\n{2,}/);
  const chunks: string[] = [];
  let current = "";

  const flush = () => {
    if (current.trim()) chunks.push(current.trim());
    current = "";
  };

  for (const para of paragraphs) {
    if (para.length > limit) {
      flush();
      // Long paragraph: break on sentence ends, then hard-cut whatever remains.
      const sentences = para.split(/(?<=[.!?。！？؟])\s+/);
      let buf = "";
      for (const s of sentences) {
        if (s.length > limit) {
          if (buf.trim()) { chunks.push(buf.trim()); buf = ""; }
          for (let i = 0; i < s.length; i += limit) chunks.push(s.slice(i, i + limit));
          continue;
        }
        if ((buf + " " + s).length > limit) { chunks.push(buf.trim()); buf = s; }
        else buf = buf ? `${buf} ${s}` : s;
      }
      if (buf.trim()) chunks.push(buf.trim());
      continue;
    }

    if ((current + "\n\n" + para).length > limit) flush();
    current = current ? `${current}\n\n${para}` : para;
  }
  flush();

  return chunks.filter(Boolean);
}
