import "server-only";

import { supabaseServer } from "@/lib/server/supabase-server";

/* ---------------------------------------------------------------------------
   note-access — central authorization for a note, covering the OWNER plus
   anyone the note has been shared with (note_shares).

     owner   — note.account_id === caller            (full control)
     editor  — note_shares.permission = 'edit'        (read + edit content)
     viewer  — note_shares.permission = 'view'        (read only)
     null    — no relationship                        (404)

   All note API routes resolve access through getNoteRole so sharing and
   ownership are enforced in one place.
   --------------------------------------------------------------------------- */

export type NoteRole = "owner" | "editor" | "viewer" | null;

export interface NoteAccess {
  role: NoteRole;
  ownerId: string | null;
  tenantId: string | null;
}

export async function getNoteRole(
  noteId: string,
  accountId: string,
): Promise<NoteAccess> {
  const { data: note } = await supabaseServer
    .from("notes")
    .select("account_id, tenant_id")
    .eq("id", noteId)
    .maybeSingle();

  if (!note) return { role: null, ownerId: null, tenantId: null };

  const base = { ownerId: note.account_id as string, tenantId: note.tenant_id as string };
  if (note.account_id === accountId) return { role: "owner", ...base };

  const { data: share } = await supabaseServer
    .from("note_shares")
    .select("permission")
    .eq("note_id", noteId)
    .eq("shared_with_account_id", accountId)
    .maybeSingle();

  if (!share) return { role: null, ...base };
  return { role: share.permission === "view" ? "viewer" : "editor", ...base };
}

export function canRead(role: NoteRole): boolean {
  return role === "owner" || role === "editor" || role === "viewer";
}

export function canWrite(role: NoteRole): boolean {
  return role === "owner" || role === "editor";
}

/** Fields a non-owner (shared editor) is allowed to change — content only,
    never the owner's organisational state (folder, pin, lock). */
export const SHARED_EDITOR_FIELDS = [
  "title",
  "body_json",
  "body_plain",
  "color",
  "tags",
] as const;
