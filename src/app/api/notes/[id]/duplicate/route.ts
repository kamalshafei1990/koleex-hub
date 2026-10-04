import "server-only";

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth, requireModuleAction } from "@/lib/server/auth";
import { canRead, getNoteAccess, noteImagePrefix } from "@/lib/notes-server";
import { NOTES_BUCKET, NOTES_IMAGE_NAME_RE, NOTE_LIMITS } from "@/lib/notes-policy";
import { extractPlainText } from "@/lib/notes-text";

/* POST /api/notes/[id]/duplicate — copy a note the caller can read into a
   NEW note the caller owns. Body: { title?: string } (the client sends the
   localized "… (copy)" title).
     · Owner: the copy stays in the same folder. Sharee: it lands unfiled
       (the owner's folders are not theirs).
     · Images are COPIED into the new note's private storage and their URLs
       rewritten — the copy must not depend on access to the original.
     · Never copies sharing, pin state or history. */

type Json = { type?: string; attrs?: Record<string, unknown>; content?: Json[]; [k: string]: unknown };

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAction(auth, "Notes", "create");
  if (deny) return deny;

  const access = await getNoteAccess<{ title: string; body_json: unknown; color: string | null; tags: string[]; folder_id: string | null }>(
    id, auth.account_id, "title, body_json, color, tags, folder_id",
  );
  if (!access.note || !canRead(access.role) || access.note.deleted_at) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const src = access.note;

  let body: { title?: unknown } = {};
  try { body = ((await req.json()) ?? {}) as typeof body; } catch { /* empty */ }
  const title = (typeof body.title === "string" ? body.title : `${src.title ?? ""}`).slice(0, NOTE_LIMITS.title);

  const newId = crypto.randomUUID();

  // Copy images and rewrite their URLs in a deep clone of the body.
  const bodyJson = src.body_json ? (JSON.parse(JSON.stringify(src.body_json)) as Json) : null;
  const copies: Array<Promise<void>> = [];
  const srcPrefix = `/api/notes/${id}/images/`;
  const walk = (n: Json | undefined) => {
    if (!n || typeof n !== "object") return;
    if (n.type === "image" && n.attrs && typeof n.attrs.src === "string" && n.attrs.src.startsWith(srcPrefix)) {
      const name = n.attrs.src.slice(srcPrefix.length);
      if (NOTES_IMAGE_NAME_RE.test(name)) {
        const ext = name.split(".").pop();
        const newName = `${crypto.randomUUID()}.${ext}`;
        n.attrs.src = `/api/notes/${newId}/images/${newName}`;
        copies.push(
          supabaseServer.storage
            .from(NOTES_BUCKET)
            .copy(`${noteImagePrefix(src.tenant_id, id)}/${name}`, `${noteImagePrefix(auth.tenant_id, newId)}/${newName}`)
            .then(({ error }) => { if (error) console.error("[api/notes/duplicate] image", error.message); }),
        );
      }
    }
    if (Array.isArray(n.content)) n.content.forEach(walk);
  };
  walk(bodyJson ?? undefined);
  await Promise.all(copies);

  const { data, error } = await supabaseServer
    .from("notes")
    .insert({
      id: newId,
      tenant_id: auth.tenant_id,
      account_id: auth.account_id,
      folder_id: access.role === "owner" ? src.folder_id : null,
      title,
      body_json: bodyJson,
      body_plain: extractPlainText(bodyJson),
      color: src.color ?? null,
      tags: Array.isArray(src.tags) ? src.tags : [],
      is_pinned: false,
    })
    .select("*")
    .single();
  if (error) {
    console.error("[api/notes/[id]/duplicate]", error.message);
    return NextResponse.json({ error: "Failed to duplicate note" }, { status: 500 });
  }
  const { yjs_state: _y, ...note } = data as Record<string, unknown>;
  void _y;
  return NextResponse.json({ note: { ...note, role: "owner", is_shared: false } });
}
