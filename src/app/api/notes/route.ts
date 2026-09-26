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
       tag=X           only notes carrying tag X (own notes)
       search=X        case-insensitive substring match on title + body_plain,
                       OR a tag containing X ("#x" searches tags too)
     List rows carry a SHORT body_plain preview (NOTE_LIMITS.preview chars),
     never the full text, and at most NOTE_LIMITS.list rows.
   POST /api/notes — create a new note. */

const COLS =
  "id, account_id, folder_id, title, body_plain, color, tags, is_pinned, deleted_at, created_at, updated_at";

/** Distinct tags (as stored) of the given rows that contain `term`. */
function tagsMatching(rows: Array<{ tags?: string[] | null }>, term: string): string[] {
  const needle = term.replace(/^#/, "").trim().toLowerCase();
  if (!needle) return [];
  const out = new Set<string>();
  for (const r of rows) for (const t of r.tags ?? []) if (String(t).toLowerCase().includes(needle)) out.add(String(t));
  return Array.from(out).slice(0, 50);
}

/** Merge two result sets by id, keep order by (pinned?, updated_at) desc. */
function mergeRows(
  a: Array<Record<string, unknown>>,
  b: Array<Record<string, unknown>>,
  pinnedFirst: boolean,
): Array<Record<string, unknown>> {
  const byId = new Map<string, Record<string, unknown>>();
  for (const r of [...a, ...b]) byId.set(r.id as string, r);
  return Array.from(byId.values())
    .sort((x, y) => {
      if (pinnedFirst && x.is_pinned !== y.is_pinned) return x.is_pinned ? -1 : 1;
      return String(y.updated_at).localeCompare(String(x.updated_at));
    })
    .slice(0, NOTE_LIMITS.list);
}

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
  const rawSearch = url.searchParams.get("search")?.trim().slice(0, NOTE_LIMITS.search);
  const tag = url.searchParams.get("tag")?.trim().slice(0, NOTE_LIMITS.tag) || null;
  // "#tag" searches tags; the text search itself ignores the leading '#'.
  const search = rawSearch ? rawSearch.replace(/^#/, "").trim() || undefined : undefined;

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
    const unread = await unreadShareIds(auth.account_id);

    const sharedQuery = () => supabaseServer
      .from("notes")
      .select(COLS + ", account:accounts!notes_account_id_fkey(username)")
      .in("id", ids)
      .is("deleted_at", null);
    let sq = sharedQuery();
    if (search) sq = sq.or(ilikeAny(["title", "body_plain"], search));
    sq = sq.order("updated_at", { ascending: false }).limit(NOTE_LIMITS.list);
    const { data: sdata, error: serr } = await sq;
    if (serr) {
      console.error("[api/notes GET shared]", serr.message);
      return NextResponse.json({ error: "Failed to load shared notes" }, { status: 500 });
    }
    let sharedRows = (sdata ?? []) as unknown as Array<Record<string, unknown>>;
    if (search) {
      const { data: tagRows } = await supabaseServer.from("notes").select("tags").in("id", ids).is("deleted_at", null);
      const matching = tagsMatching((tagRows ?? []) as Array<{ tags: string[] }>, rawSearch ?? "");
      if (matching.length) {
        const { data: byTag } = await sharedQuery().overlaps("tags", matching).limit(NOTE_LIMITS.list);
        sharedRows = mergeRows(sharedRows, (byTag ?? []) as unknown as Array<Record<string, unknown>>, false);
      }
    }
    const notes = sharedRows.map((n) => {
      const acc = n.account as { username?: string } | { username?: string }[] | null;
      const ownerName = Array.isArray(acc) ? acc[0]?.username : acc?.username;
      const { account: _drop, ...rest } = n;
      void _drop;
      return {
        ...withPreview(rest),
        shared_role: permByNote.get(n.id as string) === "view" ? "viewer" : "editor",
        owner_name: ownerName ?? null,
        unread: unread.has(n.id as string),
      };
    });
    return NextResponse.json({ notes });
  }

  const scoped = () => {
    let b = supabaseServer
      .from("notes")
      .select(COLS)
      .eq("account_id", auth.account_id);
    if (folder === "trash") {
      b = b.not("deleted_at", "is", null);
    } else {
      b = b.is("deleted_at", null);
      if (folderId) b = b.eq("folder_id", folderId);
      else if (folder === "none") b = b.is("folder_id", null);
      else if (folder === "pinned") b = b.eq("is_pinned", true);
      // folder === "all" or unspecified → no folder filter
    }
    if (tag) b = b.contains("tags", [tag]);
    return b
      .order("is_pinned", { ascending: false })
      .order("updated_at", { ascending: false })
      .limit(NOTE_LIMITS.list);
  };

  let q = scoped();
  if (search) q = q.or(ilikeAny(["title", "body_plain"], search));

  /* Tag matches: resolve which of the caller's tags contain the term, then
     a second query by array overlap (PostgREST cannot substring-match
     inside an array). Both run in parallel with the main list. */
  const tagQuery = search
    ? supabaseServer
        .from("notes")
        .select("tags")
        .eq("account_id", auth.account_id)
        .not("tags", "eq", "{}")
        .limit(5000)
        .then(async ({ data }) => {
          const matching = tagsMatching((data ?? []) as Array<{ tags: string[] }>, rawSearch ?? "");
          if (!matching.length) return [] as Array<Record<string, unknown>>;
          const { data: rows } = await scoped().overlaps("tags", matching);
          return (rows ?? []) as Array<Record<string, unknown>>;
        })
    : Promise.resolve([] as Array<Record<string, unknown>>);

  /* The "is shared" flag comes from the caller's own outgoing shares — an
     independent query, so it runs in parallel with the list instead of
     waiting for the ids. Only the owner can share, so shared_by = caller
     covers every share of the caller's notes. */
  const [listRes, sharedRes, tagRows] = await Promise.all([
    q,
    folder === "trash"
      ? Promise.resolve({ data: [] as Array<{ note_id: string }> })
      : supabaseServer.from("note_shares").select("note_id").eq("shared_by_account_id", auth.account_id),
    tagQuery,
  ]);
  if (listRes.error) {
    console.error("[api/notes GET]", listRes.error.message);
    return NextResponse.json({ error: "Failed to load notes" }, { status: 500 });
  }

  const sharedSet = new Set(((sharedRes.data ?? []) as Array<{ note_id: string }>).map((s) => s.note_id));
  const listRows = (listRes.data ?? []) as Array<Record<string, unknown>>;
  const merged = tagRows.length ? mergeRows(listRows, tagRows, true) : listRows;
  const rows = merged.map((r) => ({
    ...withPreview(r),
    is_shared: sharedSet.has(r.id as string),
  }));
  return NextResponse.json({ notes: rows });
}

/** Notes shared with `accountId` that they have not opened yet. Empty when
 *  the last_opened_at column does not exist yet (migration 20260926). */
async function unreadShareIds(accountId: string): Promise<Set<string>> {
  const { data, error } = await supabaseServer
    .from("note_shares")
    .select("note_id")
    .eq("shared_with_account_id", accountId)
    .is("last_opened_at", null);
  if (error) return new Set();
  return new Set(((data ?? []) as Array<{ note_id: string }>).map((r) => r.note_id));
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
