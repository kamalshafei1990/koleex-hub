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
  /** "Shared with me" rows: not opened yet. */
  unread?: boolean;
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
  /** Only notes carrying this tag (own notes). */
  tag?: string;
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
  if (options.tag) params.set("tag", options.tag);
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
  tags?: string[];
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
  /** Collaborative save: the full Yjs state (base64) — merged server-side;
   *  body_json is then derived there and must not be sent. */
  yjs_update: string;
  title: string;
  body_json: unknown;
  folder_id: string | null;
  is_pinned: boolean;
  color: string | null;
  tags: string[];
}>;

/** A note's metadata as the client last saw it (for a meta 3-way merge). */
export type NoteMetaBase = { title?: string; tags?: string[]; color?: string | null };

export type UpdateNoteResult =
  | {
      ok: true;
      updated_at: string | null;
      body_plain?: string;
      /** A rebase landed: the body the server merged our changes into.
       *  `kept`: blocks we deleted that were kept because someone edited them. */
      merged?: { body_json: Record<string, unknown>; conflicts: number; kept: number };
      /** A meta rebase (`metaBase`) landed: the note's resulting title /
       *  tags / colour, and the fields where the current value was kept. */
      meta?: { title: string; tags: string[]; color: string | null };
      metaConflicts?: string[];
      /** A live save kept blocks someone deleted while we typed in them. */
      kept?: number;
    }
  | { ok: false; conflict: true; note: NoteFull }
  | { ok: false; conflict: false };

/**
 * PATCH a note. Pass `base` (the updated_at this client last saw) to make the
 * write conditional — a 409 comes back with the fresh note. `rebaseFrom`
 * (the body our edits started from) turns a body save into a REBASE: the
 * server 3-way merges our changes onto the current note instead of refusing
 * a stale copy. `metaBase` (title / tags / colour as we last saw them)
 * turns a retry's metadata into a 3-way merge: only what we changed is
 * applied onto the current note. `keepalive` lets the request outlive the
 * page (pagehide / tab hidden flush).
 */
export async function updateNote(
  id: string,
  patch: NotePatch,
  opts: { base?: string | null; keepalive?: boolean; rebaseFrom?: unknown; metaBase?: NoteMetaBase } = {},
): Promise<UpdateNoteResult> {
  try {
    const payload: Record<string, unknown> = { ...patch };
    if (opts.base) payload.base_updated_at = opts.base;
    if (opts.rebaseFrom !== undefined) payload.rebase_from_base = opts.rebaseFrom ?? null;
    if (opts.metaBase) payload.meta_base = opts.metaBase;
    const body = JSON.stringify(payload);
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
    const json = (await res.json().catch(() => ({}))) as {
      updated_at?: string | null;
      body_plain?: string;
      merged?: { body_json?: unknown; conflicts?: unknown; kept?: unknown };
      meta?: { title?: unknown; tags?: unknown; color?: unknown };
      meta_conflicts?: unknown;
      kept?: unknown;
    };
    const merged =
      json.merged && json.merged.body_json && typeof json.merged.body_json === "object"
        ? {
            body_json: json.merged.body_json as Record<string, unknown>,
            conflicts: Number(json.merged.conflicts) || 0,
            kept: Number(json.merged.kept) || 0,
          }
        : undefined;
    const meta =
      json.meta && typeof json.meta === "object"
        ? {
            title: typeof json.meta.title === "string" ? json.meta.title : "",
            tags: Array.isArray(json.meta.tags) ? json.meta.tags.filter((x): x is string => typeof x === "string") : [],
            color: typeof json.meta.color === "string" ? json.meta.color : null,
          }
        : undefined;
    const metaConflicts = Array.isArray(json.meta_conflicts)
      ? json.meta_conflicts.filter((x): x is string => typeof x === "string")
      : undefined;
    const kept = Number(json.kept) || 0;
    return {
      ok: true,
      updated_at: json.updated_at ?? null,
      body_plain: json.body_plain,
      ...(merged ? { merged } : {}),
      ...(meta ? { meta, metaConflicts: metaConflicts ?? [] } : {}),
      ...(kept ? { kept } : {}),
    };
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

/** Copy a readable note into a new note owned by the caller. */
export async function duplicateNote(id: string, title: string): Promise<NoteFull | null> {
  try {
    const res = await fetch(`/api/notes/${id}/duplicate`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title }),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { note: NoteFull };
    return json.note;
  } catch {
    return null;
  }
}

/* ── Tags ── */

export interface TagCount { tag: string; count: number }

export async function fetchTags(): Promise<TagCount[]> {
  const res = await fetch("/api/notes/tags", { credentials: "include" });
  if (!res.ok) throw new Error(`tags ${res.status}`);
  const json = (await res.json()) as { tags?: TagCount[] };
  return json.tags ?? [];
}

/** Notes shared with me that I have not opened yet. */
export async function fetchSharedUnread(): Promise<{ count: number; ids: string[] }> {
  try {
    const res = await fetch("/api/notes/shared-unread", { credentials: "include", cache: "no-store" });
    if (!res.ok) return { count: 0, ids: [] };
    const json = (await res.json()) as { count?: number; ids?: string[] };
    return { count: json.count ?? 0, ids: json.ids ?? [] };
  } catch {
    return { count: 0, ids: [] };
  }
}

/* ── Version history ── */

export interface NoteVersionRow {
  id: string;
  title: string;
  account_id: string | null;
  author_name: string | null;
  created_at: string;
}

export interface NoteVersionFull {
  id: string;
  note_id: string;
  title: string;
  body_json: unknown | null;
  created_at: string;
}

export async function fetchVersions(noteId: string): Promise<{ available: boolean; versions: NoteVersionRow[] } | null> {
  try {
    const res = await fetch(`/api/notes/${noteId}/versions`, { credentials: "include", cache: "no-store" });
    if (!res.ok) return null;
    const json = (await res.json()) as { available?: boolean; versions?: NoteVersionRow[] };
    return { available: json.available !== false, versions: json.versions ?? [] };
  } catch {
    return null;
  }
}

export async function fetchVersion(noteId: string, versionId: string): Promise<NoteVersionFull | null> {
  try {
    const res = await fetch(`/api/notes/${noteId}/versions/${versionId}`, { credentials: "include", cache: "no-store" });
    if (!res.ok) return null;
    return ((await res.json()) as { version: NoteVersionFull }).version;
  } catch {
    return null;
  }
}

export async function saveVersion(noteId: string): Promise<boolean> {
  try {
    const res = await fetch(`/api/notes/${noteId}/versions`, { method: "POST", credentials: "include" });
    return res.ok;
  } catch {
    return false;
  }
}

/* ── Backlinks ── */

export interface BacklinkRow { id: string; title: string; updated_at: string }

export async function fetchBacklinks(noteId: string): Promise<BacklinkRow[] | null> {
  try {
    const res = await fetch(`/api/notes/${noteId}/backlinks`, { credentials: "include", cache: "no-store" });
    if (!res.ok) return null;
    const json = (await res.json()) as { available?: boolean; notes?: BacklinkRow[] };
    return json.available === false ? null : json.notes ?? [];
  } catch {
    return null;
  }
}

/* ── Koleex AI ── */

export type NoteAiResult =
  | { ok: true; kind: "summary"; text: string }
  | { ok: true; kind: "actions"; items: string[] }
  | { ok: false; reason: "busy" | "forbidden" | "empty" | "failed" };

export async function runNoteAi(noteId: string, action: "summary" | "actions"): Promise<NoteAiResult> {
  try {
    const res = await fetch(`/api/notes/${noteId}/ai`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    const json = (await res.json().catch(() => ({}))) as { text?: string; items?: string[]; error?: string };
    if (!res.ok) {
      const reason = res.status === 429 ? "busy" : res.status === 403 ? "forbidden" : json.error === "empty" ? "empty" : "failed";
      return { ok: false, reason };
    }
    if (action === "summary") return { ok: true, kind: "summary", text: json.text ?? "" };
    return { ok: true, kind: "actions", items: json.items ?? [] };
  } catch {
    return { ok: false, reason: "failed" };
  }
}

/* ── Checklist → To-do ── */

/** Create a personal To-do from a checklist item (POST /api/todos). */
export async function createTodoFromNote(input: {
  title: string;
  noteId: string;
  noteTitle: string;
  description: string;
}): Promise<{ ok: true; id: string } | { ok: false; forbidden: boolean }> {
  try {
    const res = await fetch("/api/todos", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: input.title.slice(0, 500),
        description: input.description,
        priority: "medium",
        status: "todo",
        source: "manual",
        metadata: { source_app: "notes", note_id: input.noteId, note_title: input.noteTitle },
      }),
    });
    if (!res.ok) return { ok: false, forbidden: res.status === 403 };
    const json = (await res.json()) as { todo?: { id?: string } };
    return json.todo?.id ? { ok: true, id: json.todo.id } : { ok: false, forbidden: false };
  } catch {
    return { ok: false, forbidden: false };
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
