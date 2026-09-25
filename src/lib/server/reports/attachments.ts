import "server-only";

/* ---------------------------------------------------------------------------
   Reports (server) — photos and files on a report (Phase 2C).

   Rows live in work_report_attachments (RLS on, no policies); objects in the
   PRIVATE report-attachments bucket. A new version copies the rows and keeps
   pointing at the same objects, so an object leaves storage only when no row
   references it any more — removeUnreferenced() is the one place that
   deletes from the bucket. What is allowed is src/lib/reports/attachments.ts.
   --------------------------------------------------------------------------- */

import { supabaseServer } from "@/lib/server/supabase-server";
import { REPORT_ATTACHMENT_BUCKET, isImageMime, type ReportAttachment } from "@/lib/reports/attachments";

export const ATTACHMENT_COLS = "id, report_id, file_name, mime_type, size_bytes, width, height, caption, position, storage_path, thumb_path, created_at";

export interface AttachmentRow {
  id: string;
  report_id: string;
  file_name: string;
  mime_type: string;
  size_bytes: number;
  width: number | null;
  height: number | null;
  caption: string;
  position: number;
  storage_path: string;
  thumb_path: string | null;
  created_at: string;
}

/** What the browser gets: never a storage path (files are fetched by id
 *  through /api/files/report/<id>, which re-checks access). */
export function toClientAttachment(r: AttachmentRow): ReportAttachment {
  return {
    id: r.id, name: r.file_name, mime: r.mime_type, size: r.size_bytes,
    width: r.width, height: r.height, caption: r.caption ?? "",
    image: isImageMime(r.mime_type), hasThumb: !!r.thumb_path,
  };
}

export function loadAttachmentRows(reportId: string) {
  return supabaseServer.from("work_report_attachments").select(ATTACHMENT_COLS)
    .eq("report_id", reportId).order("position", { ascending: true }).order("created_at", { ascending: true }).limit(100);
}

/** Remove these objects from the bucket — each one only if no row (of any
 *  version) still points at it. Run after the rows are gone. */
export async function removeUnreferenced(paths: Array<string | null | undefined>): Promise<void> {
  const unique = Array.from(new Set(paths.filter((p): p is string => !!p)));
  if (!unique.length) return;
  const [{ data: full }, { data: thumbs }] = await Promise.all([
    supabaseServer.from("work_report_attachments").select("storage_path").in("storage_path", unique),
    supabaseServer.from("work_report_attachments").select("thumb_path").in("thumb_path", unique),
  ]);
  const still = new Set<string>([
    ...((full ?? []) as { storage_path: string }[]).map((r) => r.storage_path),
    ...((thumbs ?? []) as { thumb_path: string | null }[]).map((r) => r.thumb_path ?? ""),
  ]);
  const gone = unique.filter((p) => !still.has(p));
  if (!gone.length) return;
  const { error } = await supabaseServer.storage.from(REPORT_ATTACHMENT_BUCKET).remove(gone);
  if (error) console.error("[reports] attachment cleanup:", error.message);
}

/** A new version starts with the same photos and files (same objects). */
export async function copyAttachments(fromReportId: string, toReportId: string): Promise<void> {
  const { data, error } = await supabaseServer.from("work_report_attachments")
    .select("tenant_id, uploaded_by, storage_path, thumb_path, file_name, mime_type, size_bytes, width, height, caption, position")
    .eq("report_id", fromReportId).limit(100);
  if (error) { console.error("[reports] attachments copy (read):", error.message); return; }
  if (!data?.length) return;
  const { error: iErr } = await supabaseServer.from("work_report_attachments")
    .insert((data as Array<Record<string, unknown>>).map((a) => ({ ...a, report_id: toReportId })));
  if (iErr) console.error("[reports] attachments copy (write):", iErr.message);
}
