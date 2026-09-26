import "server-only";

/* ---------------------------------------------------------------------------
   todo-attachments — the one definition of a task attachment's storage
   object: bucket, allowed types, size, and the exact path shape. The upload
   route writes it; the attachment route reads it back; edits and deletes
   release it.
   --------------------------------------------------------------------------- */

import { supabaseServer } from "@/lib/server/supabase-server";

export const TODO_ATTACHMENT_BUCKET = "todo-attachments";
export const TODO_ATTACHMENT_MAX_BYTES = 10 * 1024 * 1024;

export const TODO_ATTACHMENT_TYPES: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
  "application/pdf": "pdf",
  "application/msword": "doc",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "application/vnd.ms-excel": "xls",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
  "text/csv": "csv",
  "text/plain": "txt",
};

const EXTS = Array.from(new Set(Object.values(TODO_ATTACHMENT_TYPES))).join("|");
const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";

/** `${tenant}/${uuid}.${ext}` under THIS tenant, and nothing else. */
export function isTodoAttachmentPath(path: string, tenantId: string): boolean {
  return new RegExp(`^${tenantId.replace(/[^0-9a-f-]/gi, "")}/${UUID}\\.(?:${EXTS})$`, "i").test(path);
}

/** The session-gated link the task stores (see /api/todos/attachment). */
export function todoAttachmentUrl(path: string): string {
  return `/api/todos/attachment?path=${encodeURIComponent(path)}`;
}

/* The declared MIME type is the browser's claim. For the binary formats the
   first bytes must agree, so an HTML or script file cannot be stored as
   "image/png". Text formats (csv, txt) have no signature. */
const SIGNATURES: Record<string, number[][]> = {
  png: [[0x89, 0x50, 0x4e, 0x47]],
  jpg: [[0xff, 0xd8, 0xff]],
  gif: [[0x47, 0x49, 0x46, 0x38]],
  webp: [[0x52, 0x49, 0x46, 0x46]],
  pdf: [[0x25, 0x50, 0x44, 0x46]],
  doc: [[0xd0, 0xcf, 0x11, 0xe0]],
  xls: [[0xd0, 0xcf, 0x11, 0xe0]],
  docx: [[0x50, 0x4b, 0x03, 0x04]],
  xlsx: [[0x50, 0x4b, 0x03, 0x04]],
};

export function contentMatchesType(ext: string, head: Uint8Array): boolean {
  const sigs = SIGNATURES[ext];
  if (!sigs) return true;
  return sigs.some((sig) => sig.every((b, i) => head[i] === b));
}

/** A display name: no path, no control characters, bounded. */
export function cleanAttachmentName(raw: unknown, fallback: string): string {
  const s = typeof raw === "string" ? raw : "";
  const base = s.split(/[\\/]/).pop()!.replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, 200);
  return base || fallback;
}

/** The storage paths a task's metadata references (metadata.attachments[].path). */
export function attachmentPathsOf(meta: unknown): string[] {
  const list = (meta as { attachments?: unknown } | null)?.attachments;
  if (!Array.isArray(list)) return [];
  return Array.from(new Set(
    list.map((a) => (a as { path?: unknown })?.path).filter((p): p is string => typeof p === "string" && p.length > 0),
  ));
}

/** Paths in `before` that `after` no longer references — what an edit removed. */
export function removedAttachmentPaths(before: unknown, after: unknown): string[] {
  const kept = new Set(attachmentPathsOf(after));
  return attachmentPathsOf(before).filter((p) => !kept.has(p));
}

/**
 * Delete the storage objects of attachments nothing references any more.
 *
 * Called AFTER the task write (a removed attachment, a deleted task).
 * Reference-counted: a recurring template and every period spawned from it
 * share the same objects, so a path is deleted only when no task in the
 * tenant still lists it (`metadata @> {"attachments":[{"path":…}]}`, served
 * by idx_koleex_todos_metadata_path). Only paths of the upload route's exact
 * shape under THIS tenant are ever touched — metadata is client-written, so
 * a path naming another tenant's (or any other) object is ignored.
 * Best-effort: logged, never thrown.
 */
export async function releaseTodoAttachments(tenantId: string | null, paths: string[]): Promise<void> {
  if (!tenantId || paths.length === 0) return;
  const candidates = Array.from(new Set(paths)).filter((p) => isTodoAttachmentPath(p, tenantId));
  const orphans: string[] = [];
  for (const path of candidates) {
    try {
      const { data, error } = await supabaseServer
        .from("koleex_todos")
        .select("id")
        .eq("tenant_id", tenantId)
        .contains("metadata", { attachments: [{ path }] })
        .limit(1);
      if (error) {
        console.error("[todo-attachments] refcount:", error.message);
        continue;
      }
      if (!data || data.length === 0) orphans.push(path);
    } catch (e) {
      console.error("[todo-attachments] refcount:", e instanceof Error ? e.message : e);
    }
  }
  if (orphans.length === 0) return;
  const { error } = await supabaseServer.storage.from(TODO_ATTACHMENT_BUCKET).remove(orphans);
  if (error) console.error("[todo-attachments] remove:", error.message);
}
