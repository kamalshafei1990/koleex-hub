"use client";

/* ---------------------------------------------------------------------------
   Notes app — client library.

   All calls go through the Next.js API layer (service_role on the server).
   Nothing here touches Supabase directly — the notes + notes_folders
   tables are closed behind RLS.

   The TipTap doc shape is stored in `body_json` (jsonb); a plain-text
   projection lives in `body_plain` for search.
   --------------------------------------------------------------------------- */

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
  tenant_id: string;
  folder_id: string | null;
  title: string;
  body_plain: string;
  is_pinned: boolean;
  is_locked: boolean;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface NoteFull extends NoteRow {
  body_json: unknown | null;
}

/* ── Folders ── */

export async function fetchFolders(): Promise<NotesFolderRow[]> {
  try {
    const res = await fetch("/api/notes/folders", { credentials: "include" });
    if (res.ok) {
      const json = (await res.json()) as { folders: NotesFolderRow[] };
      return json.folders;
    }
    return [];
  } catch (e) {
    console.error("[Notes] fetchFolders:", e);
    return [];
  }
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

export interface FetchNotesOptions {
  folderId?: string | null;
  /** "all" | "none" (loose) | "pinned" | "trash" — overrides folderId */
  smartFolder?: "all" | "none" | "pinned" | "trash";
  search?: string;
}

export async function fetchNotes(
  options: FetchNotesOptions = {},
): Promise<NoteRow[]> {
  try {
    const params = new URLSearchParams();
    if (options.folderId) params.set("folder_id", options.folderId);
    else if (options.smartFolder) params.set("folder", options.smartFolder);
    if (options.search) params.set("search", options.search);
    const qs = params.toString();
    const res = await fetch("/api/notes" + (qs ? "?" + qs : ""), {
      credentials: "include",
    });
    if (!res.ok) return [];
    const json = (await res.json()) as { notes: NoteRow[] };
    return json.notes;
  } catch (e) {
    console.error("[Notes] fetchNotes:", e);
    return [];
  }
}

export async function fetchNote(id: string): Promise<NoteFull | null> {
  try {
    const res = await fetch("/api/notes/" + id, { credentials: "include" });
    if (!res.ok) return null;
    const json = (await res.json()) as { note: NoteFull };
    return json.note;
  } catch {
    return null;
  }
}

export async function createNote(input: {
  title?: string;
  body_json?: unknown;
  body_plain?: string;
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

export async function updateNote(
  id: string,
  patch: Partial<{
    title: string;
    body_json: unknown;
    body_plain: string;
    folder_id: string | null;
    is_pinned: boolean;
  }>,
): Promise<boolean> {
  try {
    const res = await fetch("/api/notes/" + id, {
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

/* ── Utilities ── */

/**
 * Flatten a TipTap document's text content into a plain string, used to
 * populate body_plain for full-text search and note-list previews.
 */
export function extractPlainText(doc: unknown): string {
  if (!doc || typeof doc !== "object") return "";
  const out: string[] = [];
  const walk = (n: unknown) => {
    if (!n || typeof n !== "object") return;
    const node = n as {
      type?: string;
      text?: string;
      content?: unknown[];
    };
    if (typeof node.text === "string") out.push(node.text);
    if (Array.isArray(node.content)) node.content.forEach(walk);
  };
  walk(doc);
  return out.join(" ").replace(/\s+/g, " ").trim();
}

/**
 * Extract the best "title" from a TipTap doc — the first non-empty text
 * content. Used when the user hasn't typed an explicit title.
 */
export function deriveAutoTitle(doc: unknown): string {
  const plain = extractPlainText(doc);
  if (!plain) return "";
  const firstLine = plain.split(/[\n\r]/)[0].trim();
  return firstLine.length > 80 ? firstLine.slice(0, 80) + "…" : firstLine;
}

/**
 * Group notes by a relative-date bucket so the Notes list can show
 * Apple-Notes-style section headers: Today / Yesterday / Previous 7 Days /
 * Previous 30 Days / <Month YYYY>.
 */
export function groupNotesByDate(
  notes: NoteRow[],
): { label: string; notes: NoteRow[] }[] {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const weekAgo = new Date(today);
  weekAgo.setDate(weekAgo.getDate() - 7);
  const monthAgo = new Date(today);
  monthAgo.setDate(monthAgo.getDate() - 30);

  const buckets: Record<string, NoteRow[]> = {};
  const order: string[] = [];

  const push = (label: string, note: NoteRow) => {
    if (!buckets[label]) {
      buckets[label] = [];
      order.push(label);
    }
    buckets[label].push(note);
  };

  const monthLabel = (d: Date) =>
    d.toLocaleDateString(undefined, { month: "long", year: "numeric" });

  for (const n of notes) {
    const d = new Date(n.updated_at);
    if (d >= today) push("Today", n);
    else if (d >= yesterday) push("Yesterday", n);
    else if (d >= weekAgo) push("Previous 7 Days", n);
    else if (d >= monthAgo) push("Previous 30 Days", n);
    else push(monthLabel(d), n);
  }

  return order.map((label) => ({ label, notes: buckets[label] }));
}

/** Friendly timestamp used in list items. */
export function formatNoteTimestamp(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
  if (sameDay) {
    return d.toLocaleTimeString(undefined, {
      hour: "numeric",
      minute: "2-digit",
    });
  }
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const isYest =
    d.getFullYear() === yesterday.getFullYear() &&
    d.getMonth() === yesterday.getMonth() &&
    d.getDate() === yesterday.getDate();
  if (isYest) return "Yesterday";
  if (d.getFullYear() === now.getFullYear()) {
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  }
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
