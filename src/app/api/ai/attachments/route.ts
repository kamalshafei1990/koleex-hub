import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/server/auth";
import { requireInternalUser } from "@/lib/server/ai/require-internal";
import { describeImage } from "@/lib/server/ai/vision";

/* ---------------------------------------------------------------------------
   POST /api/ai/attachments — turn whatever the user attached in Koleex AI
   into text, so it can ride along with the chat turn (multipart form-data,
   field "files", up to 6).

   Everything becomes TEXT here, deliberately. The rest of the AI — the
   agent, its tools, the permission checks, the audit log — reads a
   conversation, and keeping that true means one place has to do the
   converting. That place is this file.

   Scope (nothing is stored — it is read, described, and forgotten):
     · .txt / .md / .csv / .json / .log  → UTF-8 text
     · .xlsx / .xls                      → every sheet as aligned rows
     · .pdf with a text layer            → that text, via unpdf
     · .pdf WITHOUT one (a scan)         → pages rasterised and READ by the
                                           vision model — this is what makes
                                           a photographed invoice work
     · images                            → read by the vision model

   Images used to be refused outright, on the correct reasoning of the day:
   the only provider configured was text-only. DeepSeek now serves a vision
   model on the SAME key (verified against the live API, 2026-08-22), so the
   refusal became a limitation we were imposing on ourselves.

   Caps: 6 files, 10 MB each, 30 000 extracted chars per file, and at most
   PDF_VISION_PAGES rasterised pages per scanned PDF — vision is the slow,
   expensive path and a 40-page scan must not hold a chat turn hostage. The
   AI endpoints are internal-only; this one is too.
   --------------------------------------------------------------------------- */

export const dynamic = "force-dynamic";

const MAX_FILES = 6;
const MAX_BYTES = 10 * 1024 * 1024;
const MAX_CHARS = 30000;

const TEXT_EXT = /\.(txt|md|markdown|csv|tsv|json|log)$/i;
const PDF_EXT = /\.pdf$/i;
const IMAGE_EXT = /\.(png|jpe?g|webp|gif|heic|heif|bmp|tiff?)$/i;
const SHEET_EXT = /\.(xlsx|xlsm|xls)$/i;
/* Read enough of a scan to be useful, few enough to stay inside a chat turn.
   Three pages covers an invoice with a continuation sheet; beyond that the
   user is better served attaching the pages they care about. */
const PDF_VISION_PAGES = 3;

type ExtractResult =
  | { name: string; chars: number; text: string }
  | { name: string; error: "unreadable_image" | "type_not_supported" | "no_text" | "too_large" | "read_failed" };


/* ── Excel ────────────────────────────────────────────────────────────────
   Sheets arrive as a grid; the model reads prose. CSV per sheet keeps rows
   and columns legible without inventing a layout, and the sheet name is kept
   because "which tab was this on" is usually half the question. */
async function readWorkbook(bytes: Uint8Array): Promise<string | null> {
  const XLSX = await import("xlsx");
  const wb = XLSX.read(bytes, { type: "array" });
  const parts: string[] = [];
  for (const sheetName of wb.SheetNames) {
    const ws = wb.Sheets[sheetName];
    if (!ws) continue;
    const csv = XLSX.utils.sheet_to_csv(ws, { blankrows: false }).trim();
    if (csv) parts.push(`--- Sheet: ${sheetName} ---\n${csv}`);
  }
  const out = parts.join("\n\n").trim();
  return out.length ? out : null;
}

/* ── Scanned PDF ──────────────────────────────────────────────────────────
   Render, then read. Best-effort throughout: a PDF that will not rasterise
   returns null and the caller falls back to the honest "no text" answer
   rather than failing the upload. */
async function readScannedPdf(
  bytes: Uint8Array,
  doc: { numPages?: number },
): Promise<string | null> {
  try {
    const { renderPageAsImage } = await import("unpdf");
    const total = Math.min(doc.numPages ?? 1, PDF_VISION_PAGES);
    const pages: string[] = [];
    for (let p = 1; p <= total; p++) {
      /* scale 2 — a 1x render of a scan is often too soft for the model to
         resolve small print, which on an invoice is the part that matters. */
      const png = await renderPageAsImage(bytes, p, { scale: 2 });
      if (!png) continue;
      const seen = await describeImage(new Uint8Array(png), "image/png");
      if (seen) pages.push(`--- Page ${p} ---\n${seen.text}`);
    }
    const out = pages.join("\n\n").trim();
    return out.length ? out : null;
  } catch (e) {
    console.error("[ai.attachments] scanned-pdf render failed", e);
    return null;
  }
}

async function extractOne(file: File): Promise<ExtractResult> {
  const name = (file.name || "file").slice(0, 120);
  if (file.size > MAX_BYTES) return { name, error: "too_large" };

  try {
    if (IMAGE_EXT.test(name) || (file.type || "").startsWith("image/")) {
      const seen = await describeImage(
        new Uint8Array(await file.arrayBuffer()),
        file.type || "image/png",
      );
      if (!seen) return { name, error: "unreadable_image" };
      /* Labelled as a reading, not passed off as the user's own words. The
         model downstream must know it is looking at a description of a
         picture — otherwise it will quote it back as if it were fact typed
         by the operator. */
      /* NO MODEL NAME HERE. This string is injected into the conversation,
         which means the assistant reads it and may echo it, and the user may
         see it — and the standing owner rule is that nothing may reveal or
         imply which model is underneath. The label says what happened, not
         who did it. */
      const text = `[Image: ${name}] — read by Koleex AI:\n${seen.text}`;
      return { name, chars: text.length, text: text.slice(0, MAX_CHARS) };
    }
    if (PDF_EXT.test(name) || file.type === "application/pdf") {
      const { extractText, getDocumentProxy } = await import("unpdf");
      const buf = new Uint8Array(await file.arrayBuffer());
      const doc = await getDocumentProxy(buf);
      const { text } = await extractText(doc, { mergePages: true });
      const clean = (Array.isArray(text) ? text.join("\n") : text ?? "").trim();
      if (clean.length >= 40) {
        return { name, chars: clean.length, text: clean.slice(0, MAX_CHARS) };
      }
      /* NO TEXT LAYER — a scan, or a photo saved as a PDF. This used to be
         the end of the road ("no_text"), which is exactly the case the owner
         asked for: photographed invoices and documents. Rasterise the first
         few pages and read them the same way an image is read. */
      const scanned = await readScannedPdf(buf, doc);
      if (scanned) {
        const t = `[Scanned PDF: ${name}] — read by Koleex AI:\n${scanned}`;
        return { name, chars: t.length, text: t.slice(0, MAX_CHARS) };
      }
      return { name, error: "no_text" };
    }
    if (SHEET_EXT.test(name) || /spreadsheet|excel/i.test(file.type || "")) {
      const sheet = await readWorkbook(new Uint8Array(await file.arrayBuffer()));
      if (!sheet) return { name, error: "no_text" };
      return { name, chars: sheet.length, text: sheet.slice(0, MAX_CHARS) };
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
