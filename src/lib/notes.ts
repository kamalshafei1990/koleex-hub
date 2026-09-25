"use client";

/* ---------------------------------------------------------------------------
   Notes app — client library.

   All calls go through the Next.js API layer (service_role on the server).
   Nothing here touches Supabase directly — the notes + notes_folders
   tables are closed behind RLS.

   The TipTap doc shape is stored in `body_json` (jsonb); a plain-text
   projection lives in `body_plain` for search (derived server-side).
   --------------------------------------------------------------------------- */

import { formatDatePref } from "@/lib/display-prefs";
import { checkNotesImage } from "@/lib/notes-policy";

export { extractPlainText, deriveAutoTitle } from "@/lib/notes-text";

type T = (key: string) => string;

export interface NotesFolderRow {
  id: string;
  account_id: string;
  tenant_id: string;
  parent_id: string | null;
  name: string;
  icon: string | null;
  sort_order: number;
  is_system: boolean;
  created_at: string;
  updated_at: string;
}

export interface NoteRow {
  id: string;
  account_id: string;
  tenant_id?: string;
  folder_id: string | null;
  title: string;
  /** In list rows this is a short PREVIEW (first ~200 chars), not the full text. */
  body_plain: string;
  color?: string | null;
  tags?: string[];
  is_pinned: boolean;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
  /** True for notes the caller owns and has shared with at least one person. */
  is_shared?: boolean;
  /* Present only for rows returned by the "Shared with me" view. */
  shared_role?: "viewer" | "editor";
  owner_name?: string | null;
}

export interface NoteFull extends NoteRow {
  body_json: unknown | null;
  /** The caller's role on this note — resolved server-side. */
  role?: NoteRole;
}

/* ── Sharing ── */

export type NoteRole = "owner" | "editor" | "viewer";

export interface ShareAccount {
  id: string;
  username: string | null;
  login_email: string | null;
  role: string | null;
  avatar_url?: string | null;
}

export interface NoteShareRow {
  id: string;
  account_id: string;
  permission: "view" | "edit";
  created_at: string;
  account: ShareAccount | null;
}

export interface NoteSharesResponse {
  role: NoteRole | null;
  isOwner: boolean;
  owner: { account_id: string; account: ShareAccount | null } | null;
  shares: NoteShareRow[];
}

export function shareAccountLabel(a: ShareAccount | null | undefined, t: T): string {
  if (!a) return t("account.unknown");
  return (a.username || a.login_email || t("account.fallback")).trim();
}

/* ── Folders ── */

export interface FoldersPayload {
  folders: NotesFolderRow[];
  /** Live notes per folder id, computed server-side. */
  counts: Record<string, number>;
}

/** Folders + per-folder counts. Throws on failure (so warm caches never
 *  memorise an error as an empty list). */
export async function fetchFolders(): Promise<FoldersPayload> {
  const res = await fetch("/api/notes/folders", { credentials: "include" });
  if (!res.ok) throw new Error(`folders ${res.status}`);
  const json = (await res.json()) as Partial<FoldersPayload>;
  return { folders: json.folders ?? [], counts: json.counts ?? {} };
}

export async function createFolder(input: {
  name: string;
  parent_id?: string | null;
  icon?: string | null;
}): Promise<NotesFolderRow | null> {
  try {
    const res = await fetch("/api/notes/folders", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { folder: NotesFolderRow };
    return json.folder;
  } catch (e) {
    console.error("[Notes] createFolder:", e);
    return null;
  }
}

export async function updateFolder(
  id: string,
  patch: Partial<Pick<NotesFolderRow, "name" | "parent_id" | "icon" | "sort_order">>,
): Promise<boolean> {
  try {
    const res = await fetch("/api/notes/folders/" + id, {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function deleteFolder(id: string): Promise<boolean> {
  try {
    const res = await fetch("/api/notes/folders/" + id, {
      method: "DELETE",
      credentials: "include",
    });
    return res.ok;
  } catch {
    return false;
  }
}

/* ── Notes ── */

export type SmartFolder = "all" | "none" | "pinned" | "trash" | "shared";

export interface FetchNotesOptions {
  folderId?: string | null;
  /** "all" | "none" (loose) | "pinned" | "trash" | "shared" — overrides folderId */
  smartFolder?: SmartFolder;
  search?: string;
}

/** List notes. Throws on failure or abort, so callers can tell "no notes"
 *  from "request failed / superseded". */
export async function fetchNotes(
  options: FetchNotesOptions = {},
  signal?: AbortSignal,
): Promise<NoteRow[]> {
  const params = new URLSearchParams();
  if (options.folderId) params.set("folder_id", options.folderId);
  else if (options.smartFolder) params.set("folder", options.smartFolder);
  if (options.search) params.set("search", options.search);
  const qs = params.toString();
  const res = await fetch("/api/notes" + (qs ? "?" + qs : ""), {
    credentials: "include",
    signal,
  });
  if (!res.ok) throw new Error(`notes ${res.status}`);
  const json = (await res.json()) as { notes: NoteRow[] };
  return json.notes ?? [];
}

export async function fetchNote(id: string): Promise<NoteFull | null> {
  try {
    const res = await fetch("/api/notes/" + id, { credentials: "include" });
    if (!res.ok) return null;
    const json = (await res.json()) as { note: NoteFull; role?: NoteRole };
    return { ...json.note, role: json.role };
  } catch {
    return null;
  }
}

export async function createNote(input: {
  title?: string;
  body_json?: unknown;
  folder_id?: string | null;
}): Promise<NoteFull | null> {
  try {
    const res = await fetch("/api/notes", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { note: NoteFull };
    return json.note;
  } catch (e) {
    console.error("[Notes] createNote:", e);
    return null;
  }
}

export type NotePatch = Partial<{
  title: string;
  body_json: unknown;
  folder_id: string | null;
  is_pinned: boolean;
  color: string | null;
  tags: string[];
}>;

export type UpdateNoteResult =
  | { ok: true; updated_at: string | null }
  | { ok: false; conflict: true; note: NoteFull }
  | { ok: false; conflict: false };

/**
 * PATCH a note. Pass `base` (the updated_at this client last saw) to make the
 * write conditional — a 409 comes back with the fresh note. `keepalive` lets
 * the request outlive the page (pagehide / tab hidden flush).
 */
export async function updateNote(
  id: string,
  patch: NotePatch,
  opts: { base?: string | null; keepalive?: boolean } = {},
): Promise<UpdateNoteResult> {
  try {
    const body = JSON.stringify(opts.base ? { ...patch, base_updated_at: opts.base } : patch);
    const res = await fetch("/api/notes/" + id, {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body,
      // keepalive bodies are capped (~64KB) by the browser; larger ones fall
      // back to a normal request, which still completes if the page lives.
      keepalive: !!opts.keepalive && body.length < 60_000,
    });
    if (res.status === 409) {
      const json = (await res.json()) as { note: NoteFull; role?: NoteRole };
      return { ok: false, conflict: true, note: { ...json.note, role: json.role } };
    }
    if (!res.ok) return { ok: false, conflict: false };
    const json = (await res.json().catch(() => ({}))) as { updated_at?: string | null };
    return { ok: true, updated_at: json.updated_at ?? null };
  } catch {
    return { ok: false, conflict: false };
  }
}

export async function deleteNote(id: string): Promise<boolean> {
  try {
    const res = await fetch("/api/notes/" + id, {
      method: "DELETE",
      credentials: "include",
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function restoreNote(id: string): Promise<boolean> {
  try {
    const res = await fetch("/api/notes/" + id + "/restore", {
      method: "POST",
      credentials: "include",
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function purgeNote(id: string): Promise<boolean> {
  try {
    const res = await fetch("/api/notes/" + id + "/purge", {
      method: "DELETE",
      credentials: "include",
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function emptyTrash(): Promise<boolean> {
  try {
    const res = await fetch("/api/notes/purge-all", {
      method: "DELETE",
      credentials: "include",
    });
    return res.ok;
  } catch {
    return false;
  }
}

/* ── Images ── */

export type UploadImageResult =
  | { ok: true; src: string }
  | { ok: false; reason: "type" | "size" | "upload" };

/** Upload an image into a note's private storage; returns the stable,
 *  access-checked URL to put in the document. */
export async function uploadNoteImage(noteId: string, file: File): Promise<UploadImageResult> {
  const pre = checkNotesImage({ size: file.size, type: file.type });
  if (!pre.ok) return { ok: false, reason: pre.reason };
  try {
    const form = new FormData();
    form.append("file", file);
    const res = await fetch(`/api/notes/${noteId}/images`, {
      method: "POST",
      credentials: "include",
      body: form,
    });
    const json = (await res.json().catch(() => ({}))) as { src?: string; reason?: string };
    if (!res.ok || !json.src) {
      const reason = json.reason === "type" || json.reason === "size" ? json.reason : "upload";
      return { ok: false, reason };
    }
    return { ok: true, src: json.src };
  } catch {
    return { ok: false, reason: "upload" };
  }
}

/* ── Sharing API ── */

export async function fetchNoteShares(noteId: string): Promise<NoteSharesResponse | null> {
  try {
    const res = await fetch(`/api/notes/${noteId}/shares`, { credentials: "include" });
    if (!res.ok) return null;
    return (await res.json()) as NoteSharesResponse;
  } catch {
    return null;
  }
}

export async function addNoteShare(
  noteId: string,
  accountId: string,
  permission: "view" | "edit",
): Promise<boolean> {
  try {
    const res = await fetch(`/api/notes/${noteId}/shares`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ account_id: accountId, permission }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function updateNoteShare(
  noteId: string,
  shareId: string,
  permission: "view" | "edit",
): Promise<boolean> {
  try {
    const res = await fetch(`/api/notes/${noteId}/shares/${shareId}`, {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ permission }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function removeNoteShare(noteId: string, shareId: string): Promise<boolean> {
  try {
    const res = await fetch(`/api/notes/${noteId}/shares/${shareId}`, {
      method: "DELETE",
      credentials: "include",
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function fetchShareCandidates(q: string, signal?: AbortSignal): Promise<ShareAccount[] | null> {
  try {
    const qs = q.trim() ? `?q=${encodeURIComponent(q.trim())}` : "";
    const res = await fetch(`/api/notes/share-candidates${qs}`, { credentials: "include", signal });
    if (!res.ok) return null;
    const json = (await res.json()) as { accounts: ShareAccount[] };
    return json.accounts ?? [];
  } catch {
    return null;
  }
}

/* ── Utilities ── */

const LOCALE: Record<string, string> = { en: "en-GB", zh: "zh-CN", ar: "ar" };

export type DateBucket =
  | { kind: "today" | "yesterday" | "week" | "month" }
  | { kind: "older"; label: string };

/**
 * Group notes by a relative-date bucket so the Notes list can show
 * Apple-Notes-style section headers: Today / Yesterday / Previous 7 Days /
 * Previous 30 Days / <Month YYYY>. `key` is stable; `label` is only set for
 * the month buckets (the caller translates the relative ones).
 */
export function groupNotesByDate(
  notes: NoteRow[],
  lang = "en",
): { key: string; bucket: DateBucket; notes: NoteRow[] }[] {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const weekAgo = new Date(today);
  weekAgo.setDate(weekAgo.getDate() - 7);
  const monthAgo = new Date(today);
  monthAgo.setDate(monthAgo.getDate() - 30);

  const buckets = new Map<string, { key: string; bucket: DateBucket; notes: NoteRow[] }>();
  const push = (key: string, bucket: DateBucket, note: NoteRow) => {
    let b = buckets.get(key);
    if (!b) { b = { key, bucket, notes: [] }; buckets.set(key, b); }
    b.notes.push(note);
  };

  for (const n of notes) {
    const d = new Date(n.updated_at);
    if (d >= today) push("today", { kind: "today" }, n);
    else if (d >= yesterday) push("yesterday", { kind: "yesterday" }, n);
    else if (d >= weekAgo) push("week", { kind: "week" }, n);
    else if (d >= monthAgo) push("month", { kind: "month" }, n);
    else {
      const key = `${d.getFullYear()}-${d.getMonth()}`;
      const label = d.toLocaleDateString(LOCALE[lang] ?? "en-GB", { month: "long", year: "numeric" });
      push(key, { kind: "older", label }, n);
    }
  }
  return Array.from(buckets.values());
}

/** Friendly timestamp used in list items: time today, "Yesterday", else D/M/Y. */
export function formatNoteTimestamp(iso: string, t: T): string {
  const d = new Date(iso);
  const now = new Date();
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
  if (sameDay) {
    return d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
  }
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const isYest =
    d.getFullYear() === yesterday.getFullYear() &&
    d.getMonth() === yesterday.getMonth() &&
    d.getDate() === yesterday.getDate();
  if (isYest) return t("section.yesterday");
  return formatDatePref(d, "dmy");
}
