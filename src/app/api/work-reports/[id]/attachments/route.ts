import "server-only";

/* ---------------------------------------------------------------------------
   POST /api/work-reports/[id]/attachments — add a photo or a file to a DRAFT
   (Phase 2C). multipart/form-data:
     file    the photo (already made smaller on the phone) or the document
     thumb   optional, a photo's small JPEG preview
     name    the name to show (defaults to the file's)
     width / height   a photo's pixel size
   The author of a draft only; anyone else gets the report's usual 404. The
   type, the size and the first bytes are checked BEFORE anything is stored
   (src/lib/reports/attachments.ts is the rule, shared with the picker), and
   a row that cannot be written takes its objects back out of storage.
   --------------------------------------------------------------------------- */

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth } from "@/lib/server/auth";
import { loadForViewer, requireReportsUser } from "@/lib/server/reports/core";
import { ATTACHMENT_COLS, toClientAttachment, type AttachmentRow } from "@/lib/server/reports/attachments";
import {
  REPORT_ATTACHMENT_BUCKET, REPORT_ATTACHMENT_LIMITS, checkReportAttachment, cleanFileName, extensionFor, isImageMime, normalizeMime, sniffMatches,
} from "@/lib/reports/attachments";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const headOf = async (b: Blob) => new Uint8Array(await b.slice(0, 16).arrayBuffer());
const dim = (v: FormDataEntryValue | null) => {
  const n = Number(typeof v === "string" ? v : NaN);
  return Number.isInteger(n) && n > 0 && n <= 20000 ? n : null;
};

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const deny = requireReportsUser(auth);
  if (deny) return deny;
  const { id } = await params;
  const loaded = await loadForViewer(id, auth);
  if (!loaded || loaded.access !== "author") return NextResponse.json({ error: "not_found" }, { status: 404 });
  const { row } = loaded;
  if (row.status !== "draft") return NextResponse.json({ error: "not_draft" }, { status: 409 });

  /* Refuse an oversized body before reading it. */
  const declared = Number(req.headers.get("content-length") ?? "0");
  if (declared > REPORT_ATTACHMENT_LIMITS.bytes + REPORT_ATTACHMENT_LIMITS.thumbBytes + 64 * 1024) {
    return NextResponse.json({ error: "too_large", max: REPORT_ATTACHMENT_LIMITS.bytes }, { status: 413 });
  }
  let form: FormData;
  try { form = await req.formData(); } catch { return NextResponse.json({ error: "bad_body" }, { status: 400 }); }
  const file = form.get("file");
  if (!(file instanceof Blob)) return NextResponse.json({ error: "no_file" }, { status: 400 });
  const mime = normalizeMime(file.type);
  const verdict = checkReportAttachment({ size: file.size, type: mime });
  if (!verdict.ok) {
    return NextResponse.json(verdict.reason === "size" ? { error: "too_large", max: verdict.max } : { error: verdict.reason === "type" ? "bad_type" : "empty" },
      { status: verdict.reason === "size" ? 413 : 415 });
  }
  if (!sniffMatches(await headOf(file), mime)) return NextResponse.json({ error: "bad_type" }, { status: 415 });

  const { count, error: cErr } = await supabaseServer.from("work_report_attachments").select("id", { count: "exact", head: true }).eq("report_id", row.id);
  if (cErr) return NextResponse.json({ error: "Could not add the file." }, { status: 500 });
  if ((count ?? 0) >= REPORT_ATTACHMENT_LIMITS.perReport) return NextResponse.json({ error: "too_many", max: REPORT_ATTACHMENT_LIMITS.perReport }, { status: 409 });

  const image = isImageMime(mime);
  const base = `${auth.tenant_id ?? "shared"}/${row.id}/${crypto.randomUUID()}`;
  const storagePath = `${base}.${extensionFor(mime)}`;
  const bucket = supabaseServer.storage.from(REPORT_ATTACHMENT_BUCKET);
  const { error: upErr } = await bucket.upload(storagePath, file, { contentType: mime, upsert: false, cacheControl: "31536000" });
  if (upErr) {
    console.error("[api/work-reports attachments] upload:", upErr.message);
    return NextResponse.json({ error: "Could not store the file." }, { status: 500 });
  }

  /* A photo's preview is optional: without it the reader shows the photo
     itself, so a bad preview is dropped, never a reason to fail. */
  let thumbPath: string | null = null;
  const thumb = form.get("thumb");
  if (image && thumb instanceof Blob && thumb.size > 0 && thumb.size <= REPORT_ATTACHMENT_LIMITS.thumbBytes
      && normalizeMime(thumb.type) === "image/jpeg" && sniffMatches(await headOf(thumb), "image/jpeg")) {
    const tp = `${base}_t.jpg`;
    const { error: tErr } = await bucket.upload(tp, thumb, { contentType: "image/jpeg", upsert: false, cacheControl: "31536000" });
    if (!tErr) thumbPath = tp;
  }

  const nameRaw = form.get("name");
  const { data: created, error: iErr } = await supabaseServer.from("work_report_attachments").insert({
    report_id: row.id, tenant_id: auth.tenant_id, uploaded_by: auth.account_id,
    storage_path: storagePath, thumb_path: thumbPath,
    file_name: cleanFileName(typeof nameRaw === "string" && nameRaw.trim() ? nameRaw : (file instanceof File ? file.name : "")),
    mime_type: mime, size_bytes: file.size,
    width: image ? dim(form.get("width")) : null, height: image ? dim(form.get("height")) : null,
    caption: "", position: count ?? 0,
  }).select(ATTACHMENT_COLS).single();
  if (iErr || !created) {
    console.error("[api/work-reports attachments] row:", iErr?.message);
    await bucket.remove([storagePath, ...(thumbPath ? [thumbPath] : [])]);
    return NextResponse.json({ error: "Could not add the file." }, { status: 500 });
  }
  return NextResponse.json({ attachment: toClientAttachment(created as AttachmentRow) }, { status: 201 });
}
