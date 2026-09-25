import "server-only";

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth, requireModuleAccess, requireModuleAction } from "@/lib/server/auth";
import { NOTE_LIMITS } from "@/lib/notes-policy";
import { ilikeAny, isUuid, ownsFolder, validateNoteInput } from "@/lib/notes-server";

/* GET  /api/notes — list notes owned by caller.
     Query params:
       folder_id=X     only in that folder
       folder=none     loose (folder_id IS NULL) — live notes without a folder
       folder=all      everywhere (default when nothing else given)
       folder=pinned   only pinned
       folder=trash    only deleted (Recently Deleted)
       folder=shared   notes other accounts shared with the caller
       search=X        case-insensitive substring match on title + body_plain
     List rows carry a SHORT body_plain preview (NOTE_LIMITS.preview chars),
     never the full text, and at most NOTE_LIMITS.list rows.
   POST /api/notes — create a new note. */

const COLS =
  "id, account_id, folder_id, title, body_plain, color, tags, is_pinned, deleted_at, created_at, updated_at";

function withPreview<T extends Record<string, unknown>>(row: T): T {
  const plain = typeof row.body_plain === "string" ? row.body_plain : "";
  return { ...row, body_plain: plain.slice(0, NOTE_LIMITS.preview) };
}

export async function GET(req: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAccess(auth, "Notes");
  if (deny) return deny;

  const url = new URL(req.url);
  const folderId = url.searchParams.get("folder_id");
  const folder = url.searchParams.get("folder");
  const search = url.searchParams.get("search")?.trim().slice(0, NOTE_LIMITS.search);

  if (folderId && !isUuid(folderId)) {
    return NextResponse.json({ notes: [] });
  }

  /* ── "Shared with me" — notes owned by OTHER accounts that have been
        shared with the caller. Driven by note_shares, not account_id. ── */
  if (folder === "shared") {
    const { data: shares } = await supabaseServer
      .from("note_shares")
      .select("note_id, permission")
      .eq("shared_with_account_id", auth.account_id);
    const shareRows = shares ?? [];
    const ids = shareRows.map((s) => s.note_id as string);
    if (ids.length === 0) return NextResponse.json({ notes: [] });
    const permByNote = new Map(shareRows.map((s) => [s.note_id as string, s.permission as string]));

    let sq = supabaseServer
      .from("notes")
      .select(COLS + ", account:accounts!notes_account_id_fkey(username)")
      .in("id", ids)
      .is("deleted_at", null);
    if (search) sq = sq.or(ilikeAny(["title", "body_plain"], search));
    sq = sq.order("updated_at", { ascending: false }).limit(NOTE_LIMITS.list);
    const { data: sdata, error: serr } = await sq;
    if (serr) {
      console.error("[api/notes GET shared]", serr.message);
      return NextResponse.json({ error: "Failed to load shared notes" }, { status: 500 });
    }
    const notes = ((sdata ?? []) as unknown as Array<Record<string, unknown>>).map((n) => {
      const acc = n.account as { username?: string } | { username?: string }[] | null;
      const ownerName = Array.isArray(acc) ? acc[0]?.username : acc?.username;
      const { account: _drop, ...rest } = n;
      void _drop;
      return {
        ...withPreview(rest),
        shared_role: permByNote.get(n.id as string) === "view" ? "viewer" : "editor",
        owner_name: ownerName ?? null,
      };
    });
    return NextResponse.json({ notes });
  }

  let q = supabaseServer
    .from("notes")
    .select(COLS)
    .eq("account_id", auth.account_id);

  if (folder === "trash") {
    q = q.not("deleted_at", "is", null);
  } else {
    q = q.is("deleted_at", null);
    if (folderId) q = q.eq("folder_id", folderId);
    else if (folder === "none") q = q.is("folder_id", null);
    else if (folder === "pinned") q = q.eq("is_pinned", true);
    // folder === "all" or unspecified → no folder filter
  }

  if (search) q = q.or(ilikeAny(["title", "body_plain"], search));

  q = q
    .order("is_pinned", { ascending: false })
    .order("updated_at", { ascending: false })
    .limit(NOTE_LIMITS.list);

  /* The "is shared" flag comes from the caller's own outgoing shares — an
     independent query, so it runs in parallel with the list instead of
     waiting for the ids. Only the owner can share, so shared_by = caller
     covers every share of the caller's notes. */
  const [listRes, sharedRes] = await Promise.all([
    q,
    folder === "trash"
      ? Promise.resolve({ data: [] as Array<{ note_id: string }> })
      : supabaseServer.from("note_shares").select("note_id").eq("shared_by_account_id", auth.account_id),
  ]);
  if (listRes.error) {
    console.error("[api/notes GET]", listRes.error.message);
    return NextResponse.json({ error: "Failed to load notes" }, { status: 500 });
  }

  const sharedSet = new Set(((sharedRes.data ?? []) as Array<{ note_id: string }>).map((s) => s.note_id));
  const rows = ((listRes.data ?? []) as Array<Record<string, unknown>>).map((r) => ({
    ...withPreview(r),
    is_shared: sharedSet.has(r.id as string),
  }));
  return NextResponse.json({ notes: rows });
}

export async function POST(req: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAction(auth, "Notes", "create");
  if (deny) return deny;

  let body: unknown;
  try { body = await req.json(); } catch { body = {}; }
  const v = validateNoteInput(body, "owner");
  if (!v.ok) return NextResponse.json({ error: v.error }, { status: 400 });
  const input = v.value;

  if (input.folder_id && !(await ownsFolder(input.folder_id, auth.account_id))) {
    return NextResponse.json({ error: "Folder not found" }, { status: 400 });
  }

  const row = {
    tenant_id: auth.tenant_id,
    account_id: auth.account_id,
    folder_id: input.folder_id ?? null,
    title: input.title ?? "",
    body_json: input.body_json ?? null,
    body_plain: input.body_plain ?? "",
    color: input.color ?? null,
    tags: input.tags ?? [],
    is_pinned: input.is_pinned ?? false,
  };

  const { data, error } = await supabaseServer
    .from("notes")
    .insert(row)
    .select("*")
    .single();
  if (error) {
    console.error("[api/notes POST]", error.message);
    return NextResponse.json({ error: "Failed to create note" }, { status: 500 });
  }
  return NextResponse.json({ note: { ...data, role: "owner", is_shared: false } });
}
