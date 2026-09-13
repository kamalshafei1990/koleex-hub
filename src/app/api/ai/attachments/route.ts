import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/server/auth";
import { requireInternalUser } from "@/lib/server/ai/require-internal";
import { consumeBudget, limitMode, BUDGETS, subjectFor } from "@/lib/server/ai/security/rate-limit";
import { describeImage, questionForPrompt } from "@/lib/server/ai/vision";
import { supabaseServer } from "@/lib/server/supabase-server";
import { assembleParts, partsFolder, removeParts, sweepStaleParts, MAX_PARTS_SERVER, UPLOAD_ID_RE } from "@/lib/server/ai/attachment-parts";

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
/* Reading a 100MB+ scanned catalogue (parse + rasterise + vision) does not
   fit the default budget. */
export const maxDuration = 120;

const MAX_FILES = 6;
/* Per-file ceilings BY KIND, not one number. Documents come in via the
   storage hop (bucket limit 500MB), so the real ceiling is what the
   extractors can chew in one turn. Images go to the vision model as base64 —
   over ~15MB the payload itself starts failing, so that cap is honest. */
const MAX_IMAGE_BYTES = 15 * 1024 * 1024;
const MAX_DOC_BYTES = 200 * 1024 * 1024;
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
async function readScannedPdf(bytes: Uint8Array, question: string): Promise<string | null> {
  try {
    /* Rasterise with pdf.js + @napi-rs/canvas DIRECTLY. This path was broken
       three ways in a row: unpdf's renderPageAsImage demanded a canvasImport
       nobody passed (every scan silently became "no_text" from the day it
       shipped); given one, it dies inside Next with a DataCloneError from
       its internal worker transfer; and unpdf's bundled pdf.js ships a
       NodeCanvasFactory whose create() UNCONDITIONALLY throws. The working
       recipe (proved standalone, then through the route): create the doc
       proxy with our own CanvasFactory backed by @napi-rs/canvas, polyfill
       the three browser globals pdf.js draws with, and drive page.render()
       ourselves. Both unpdf and @napi-rs/canvas must stay in
       serverExternalPackages — bundling strips the native .node binary. */
    const napi = await import("@napi-rs/canvas");
    const g = globalThis as Record<string, unknown>;
    if (!g.ImageData && napi.ImageData) g.ImageData = napi.ImageData;
    if (!g.Path2D && napi.Path2D) g.Path2D = napi.Path2D;
    if (!g.DOMMatrix && napi.DOMMatrix) g.DOMMatrix = napi.DOMMatrix;

    class NativeCanvasFactory {
      create(w: number, h: number) {
        const canvas = napi.createCanvas(w, h);
        return { canvas, context: canvas.getContext("2d") };
      }
      reset(cc: { canvas: { width: number; height: number } }, w: number, h: number) {
        cc.canvas.width = w;
        cc.canvas.height = h;
      }
      destroy(cc: { canvas: { width: number; height: number } }) {
        cc.canvas.width = 0;
        cc.canvas.height = 0;
      }
    }

    const { getDocumentProxy } = await import("unpdf");
    /* The Next server runtime defines a Worker global, so pdf.js tries to
       hand getDocument's params to a REAL worker via structured clone — and
       a class (our CanvasFactory) is not clonable: DataCloneError. Plain
       Node has no Worker, pdf.js uses its in-process fake worker, and the
       identical code works. Hide Worker for the duration of doc creation so
       pdf.js picks the fake worker here too. */
    const gWorker = globalThis as { Worker?: unknown };
    const savedWorker = gWorker.Worker;
    let doc: Awaited<ReturnType<typeof getDocumentProxy>>;
    try {
      delete gWorker.Worker;
      doc = await getDocumentProxy(bytes, {
        CanvasFactory: NativeCanvasFactory,
      } as unknown as Parameters<typeof getDocumentProxy>[1]);
    } finally {
      if (savedWorker !== undefined) gWorker.Worker = savedWorker;
    }
    const total = Math.min(doc.numPages ?? 1, PDF_VISION_PAGES);
    const pages: string[] = [];
    for (let p = 1; p <= total; p++) {
      /* scale 2 — a 1x render of a scan is often too soft for the model to
         resolve small print, which on an invoice is the part that matters. */
      const page = await doc.getPage(p);
      const viewport = page.getViewport({ scale: 2 });
      const canvas = napi.createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
      const ctx = canvas.getContext("2d");
      await page.render({
        canvasContext: ctx,
        canvas,
        viewport,
      } as unknown as Parameters<typeof page.render>[0]).promise;
      const png = canvas.toBuffer("image/png");
      if (!png?.length) continue;
      const seen = await describeImage(new Uint8Array(png), "image/png", { question });
      if (seen) pages.push(`--- Page ${p} ---\n${seen.text}`);
    }
    const out = pages.join("\n\n").trim();
    return out.length ? out : null;
  } catch (e) {
    console.error("[ai.attachments] scanned-pdf render failed", e);
    return null;
  }
}

interface IncomingFile {
  name: string;
  type: string;
  size: number;
  bytes: () => Promise<Uint8Array>;
}

/* `question` is the user's own typed words for this turn (capped, one
   line): the vision model reads the picture FOR that question, which is what
   made the reading short enough to be quick (2026-09-04). */
async function extractOne(file: IncomingFile, question: string): Promise<ExtractResult> {
  const name = (file.name || "file").slice(0, 120);
  const isImage = IMAGE_EXT.test(name) || (file.type || "").startsWith("image/");
  if (file.size > (isImage ? MAX_IMAGE_BYTES : MAX_DOC_BYTES)) {
    return { name, error: "too_large" };
  }

  try {
    if (isImage) {
      const seen = await describeImage(await file.bytes(), file.type || "image/png", { question });
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
      const buf = await file.bytes();
      /* getDocument TRANSFERS buf's ArrayBuffer to pdf.js's fake worker and
         detaches it — after extractText the bytes are gone. The scan path
         needs its own copy, and it must be taken BEFORE that first
         getDocument (slicing a detached buffer throws). Briefly doubles the
         PDF's memory; released as soon as this call returns. */
      const scanCopy = buf.slice();
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
      const scanned = await readScannedPdf(scanCopy, question);
      if (scanned) {
        const t = `[Scanned PDF: ${name}] — read by Koleex AI:\n${scanned}`;
        return { name, chars: t.length, text: t.slice(0, MAX_CHARS) };
      }
      return { name, error: "no_text" };
    }
    if (SHEET_EXT.test(name) || /spreadsheet|excel/i.test(file.type || "")) {
      const sheet = await readWorkbook(await file.bytes());
      if (!sheet) return { name, error: "no_text" };
      return { name, chars: sheet.length, text: sheet.slice(0, MAX_CHARS) };
    }
    if (TEXT_EXT.test(name) || (file.type || "").startsWith("text/") || file.type === "application/json") {
      const raw = new TextDecoder().decode(await file.bytes()).trim();
      if (!raw) return { name, error: "no_text" };
      return { name, chars: raw.length, text: raw.slice(0, MAX_CHARS) };
    }
    return { name, error: "type_not_supported" };
  } catch (e) {
    console.error("[ai.attachments] extract failed", name, e);
    return { name, error: "read_failed" };
  }
}

/* ── Storage-hop mode ─────────────────────────────────────────────────────
   Big files never cross this function as bytes: the browser uploads them to
   Supabase Storage directly (signed URL — same pattern as the finance
   documents), then posts JSON refs here. We download, extract, and DELETE
   the temp object in all cases: the privacy contract of this endpoint is
   "read, described, and forgotten", and the hop must not quietly turn into
   a store. Paths are restricted to the caller's own ai-attachments prefix
   so a ref cannot point this endpoint at an arbitrary object. */
interface StorageRef { name?: unknown; path?: unknown; type?: unknown; size?: unknown; upload?: unknown; parts?: unknown }

async function extractFromStorage(ref: StorageRef, question: string): Promise<ExtractResult> {
  const name = (typeof ref.name === "string" && ref.name ? ref.name : "file").slice(0, 120);
  const path = typeof ref.path === "string" ? ref.path : "";
  if (!path || path.includes("..") || !/(^|\/)ai-attachments\//.test(path)) {
    return { name, error: "read_failed" };
  }
  try {
    /* The download of a big object can die mid-body (socket cut) — that
       throws from arrayBuffer(), it is not returned as {error}. One retry,
       then a clean per-file failure instead of a route-level 500. */
    let buf: Uint8Array | null = null;
    for (let attempt = 0; attempt < 2 && !buf; attempt++) {
      try {
        const { data, error } = await supabaseServer.storage.from("media").download(path);
        if (error || !data) {
          console.error("[ai.attachments] storage download failed", path, error?.message);
        } else {
          buf = new Uint8Array(await data.arrayBuffer());
        }
      } catch (e) {
        console.error("[ai.attachments] storage download threw", path, e);
      }
    }
    if (!buf) return { name, error: "read_failed" };
    return await extractOne({
      name,
      type: typeof ref.type === "string" ? ref.type : "",
      size: buf.byteLength,
      bytes: async () => buf!,
    }, question);
  } finally {
    /* Best-effort cleanup, success or failure — the object was transport,
       not storage. */
    void supabaseServer.storage.from("media").remove([path]).catch(() => undefined);
  }
}

/* ── Relay mode (2026-09-04) ──────────────────────────────────────────────
   The pieces came through /api/ai/attachments/chunk into the CALLER's own
   transport folder — composed here from the signed-in account id, never
   from the ref — so a ref can only name the caller's uploads. Every piece
   is read, joined, extracted, and removed, success or failure. */
async function extractFromParts(ref: StorageRef, accountId: string, question: string): Promise<ExtractResult> {
  const name = (typeof ref.name === "string" && ref.name ? ref.name : "file").slice(0, 120);
  const upload = typeof ref.upload === "string" ? ref.upload : "";
  const parts = typeof ref.parts === "number" ? ref.parts : Number(ref.parts);
  if (!UPLOAD_ID_RE.test(upload) || !Number.isInteger(parts) || parts < 1 || parts > MAX_PARTS_SERVER) {
    return { name, error: "read_failed" };
  }
  const folder = partsFolder(accountId, upload);
  try {
    const isImage = IMAGE_EXT.test(name) || (typeof ref.type === "string" && ref.type.startsWith("image/"));
    const buf = await assembleParts(folder, parts, isImage ? MAX_IMAGE_BYTES : MAX_DOC_BYTES);
    if (!buf) return { name, error: "read_failed" };
    return await extractOne({
      name,
      type: typeof ref.type === "string" ? ref.type : "",
      size: buf.byteLength,
      bytes: async () => buf,
    }, question);
  } finally {
    void removeParts(folder, parts);
  }
}

export async function POST(req: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  {
    const notInternal = requireInternalUser(auth);
    if (notInternal) return notInternal;
  }

  /* ── AUDIT ISSUE 4 (P0): rate limiting ────────────────────────────────
     This route is the most expensive surface in the product: 6 files per
     request, and a scanned PDF rasterises up to PDF_VISION_PAGES pages, each
     read by a REASONING vision model at max_tokens 2000 — up to 18 vision
     calls per single HTTP request, with maxDuration 120. Its own budget,
     tighter than the chat budget, for that reason. Fails open. */
  if (limitMode() !== "off") {
    const v = await consumeBudget(
      subjectFor.account(auth.account_id),
      BUDGETS.attachmentPerAccount(),
    );
    if (!v.allowed) {
      console.warn(`[ai.ratelimit] ep=attachments count=${v.count} max=${v.max} mode=${limitMode()}`);
      if (limitMode() === "enforce") {
        return NextResponse.json(
          { error: "Too many uploads in a short time. Give it a moment and try again." },
          { status: 429, headers: { "Retry-After": String(v.retryAfterSec) } },
        );
      }
    }
  }

  const t0 = Date.now();
  const finish = (results: ExtractResult[], mode: string) => {
    /* Counts and timing only — never a name, never a byte of content. */
    console.log(`[ai.attachments] ok mode=${mode} files=${results.length} read=${results.filter((r) => "text" in r).length} ms=${Date.now() - t0}`);
    return NextResponse.json({ files: results });
  };

  /* JSON mode: {files:[{name,path,type,size} | {name,upload,parts,type,size}], question?}
     — storage refs (the direct road) or relayed pieces. Big files, so one at
     a time: two catalogues joined in parallel is twice the memory. */
  const ctype = (req.headers.get("content-type") || "").toLowerCase();
  if (ctype.includes("application/json")) {
    const body = (await req.json().catch(() => null)) as { files?: StorageRef[]; question?: unknown } | null;
    const refs = Array.isArray(body?.files) ? body.files.slice(0, MAX_FILES) : [];
    if (refs.length === 0) {
      return NextResponse.json({ error: "no files" }, { status: 400 });
    }
    const question = questionForPrompt(typeof body?.question === "string" ? body.question : "");
    const results: ExtractResult[] = [];
    const keep = new Set<string>();
    for (const ref of refs) {
      if (typeof ref.upload === "string") {
        keep.add(ref.upload.toLowerCase());
        results.push(await extractFromParts(ref, auth.account_id, question));
      } else {
        results.push(await extractFromStorage(ref, question));
      }
    }
    if (keep.size > 0) void sweepStaleParts(auth.account_id, keep);
    return finish(results, "refs");
  }

  /* Multipart mode: small files still ride the request body. When parsing
     fails it is almost always the platform body cap (4.5MB on Vercel) —
     say so, instead of the old generic 400 the client swallowed silently. */
  const form = await req.formData().catch(() => null);
  if (!form) {
    return NextResponse.json(
      { error: "The upload was too large for this route. The app should upload big files directly — update and retry." },
      { status: 413 },
    );
  }
  const files = form
    .getAll("files")
    .filter((f): f is File => f instanceof File)
    .slice(0, MAX_FILES);
  if (files.length === 0) {
    return NextResponse.json({ error: "no files" }, { status: 400 });
  }
  const question = questionForPrompt(String(form.get("question") ?? ""));

  const results = await Promise.all(
    files.map((f) =>
      extractOne({
        name: f.name,
        type: f.type,
        size: f.size,
        bytes: async () => new Uint8Array(await f.arrayBuffer()),
      }, question),
    ),
  );
  return finish(results, "inline");
}
