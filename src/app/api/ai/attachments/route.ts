import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/server/auth";
import { requireInternalUser } from "@/lib/server/ai/require-internal";

/* ---------------------------------------------------------------------------
   POST /api/ai/attachments — extract readable text from files the user
   attaches in Koleex AI, so the extracted text can ride along with the
   chat turn (multipart form-data, field "files", up to 6).

   V1 scope (text extraction only — nothing is stored):
     · .txt / .md / .csv / .json / .log  → UTF-8 text
     · .pdf                              → text layer via unpdf
     · images                            → rejected (no vision provider
       is configured; DeepSeek is text-only) with a clear error code
     · scanned PDFs (no text layer)      → "no_text"

   Caps: 6 files, 10 MB each, 30 000 extracted chars per file. The AI
   endpoints are internal-only; this one is too.
   --------------------------------------------------------------------------- */

export const dynamic = "force-dynamic";

const MAX_FILES = 6;
const MAX_BYTES = 10 * 1024 * 1024;
const MAX_CHARS = 30000;

const TEXT_EXT = /\.(txt|md|markdown|csv|tsv|json|log)$/i;
const PDF_EXT = /\.pdf$/i;
const IMAGE_EXT = /\.(png|jpe?g|webp|gif|heic|heif|bmp|tiff?)$/i;

type ExtractResult =
  | { name: string; chars: number; text: string }
  | { name: string; error: "image_not_supported" | "type_not_supported" | "no_text" | "too_large" | "read_failed" };

async function extractOne(file: File): Promise<ExtractResult> {
  const name = (file.name || "file").slice(0, 120);
  if (file.size > MAX_BYTES) return { name, error: "too_large" };

  try {
    if (IMAGE_EXT.test(name) || (file.type || "").startsWith("image/")) {
      return { name, error: "image_not_supported" };
    }
    if (PDF_EXT.test(name) || file.type === "application/pdf") {
      const { extractText, getDocumentProxy } = await import("unpdf");
      const buf = new Uint8Array(await file.arrayBuffer());
      const doc = await getDocumentProxy(buf);
      const { text } = await extractText(doc, { mergePages: true });
      const clean = (Array.isArray(text) ? text.join("\n") : text ?? "").trim();
      if (clean.length < 40) return { name, error: "no_text" };
      return { name, chars: clean.length, text: clean.slice(0, MAX_CHARS) };
    }
    if (TEXT_EXT.test(name) || (file.type || "").startsWith("text/") || file.type === "application/json") {
      const raw = (await file.text()).trim();
      if (!raw) return { name, error: "no_text" };
      return { name, chars: raw.length, text: raw.slice(0, MAX_CHARS) };
    }
    return { name, error: "type_not_supported" };
  } catch (e) {
    console.error("[ai.attachments] extract failed", name, e);
    return { name, error: "read_failed" };
  }
}

export async function POST(req: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  {
    const notInternal = requireInternalUser(auth);
    if (notInternal) return notInternal;
  }

  const form = await req.formData().catch(() => null);
  if (!form) {
    return NextResponse.json({ error: "multipart form-data required" }, { status: 400 });
  }
  const files = form
    .getAll("files")
    .filter((f): f is File => f instanceof File)
    .slice(0, MAX_FILES);
  if (files.length === 0) {
    return NextResponse.json({ error: "no files" }, { status: 400 });
  }

  const results = await Promise.all(files.map(extractOne));
  return NextResponse.json({ files: results });
}
