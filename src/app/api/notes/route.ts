import "server-only";

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth, requireModuleAccess } from "@/lib/server/auth";

/* GET  /api/notes — list notes owned by caller.
     Query params:
       folder_id=X     only in that folder
       folder=none     loose (folder_id IS NULL) — live notes without a folder
       folder=all      everywhere (default when nothing else given)
       folder=pinned   only pinned
       folder=trash    only deleted (Recently Deleted)
       search=X        full-text match on title + body_plain
   POST /api/notes — create a new note. */

export async function GET(req: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAccess(auth, "Notes");
  if (deny) return deny;

  const url = new URL(req.url);
  const folderId = url.searchParams.get("folder_id");
  const folder = url.searchParams.get("folder");
  const search = url.searchParams.get("search")?.trim();

  let q = supabaseServer
    .from("notes")
    .select(
      "id, folder_id, title, body_plain, is_pinned, is_locked, deleted_at, created_at, updated_at",
    )
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

  if (search) {
    // Simple ilike fallback — avoids issues with tsquery parsing of
    // partial words + non-English input. Works fine for the data
    // sizes we're targeting (thousands of notes per user).
    const term = `%${search}%`;
    q = q.or(`title.ilike.${term},body_plain.ilike.${term}`);
  }

  q = q
    .order("is_pinned", { ascending: false })
    .order("updated_at", { ascending: false });

  const { data, error } = await q;
  if (error) {
    console.error("[api/notes GET]", error.message);
    return NextResponse.json({ error: "Failed to load notes" }, { status: 500 });
  }
  return NextResponse.json({ notes: data ?? [] });
}

export async function POST(req: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAccess(auth, "Notes");
  if (deny) return deny;

  const body = (await req.json()) as {
    title?: string;
    body_json?: unknown;
    body_plain?: string;
    folder_id?: string | null;
    is_pinned?: boolean;
  };

  const row = {
    tenant_id: auth.tenant_id,
    account_id: auth.account_id,
    folder_id: body.folder_id ?? null,
    title: body.title ?? "",
    body_json: body.body_json ?? null,
    body_plain: body.body_plain ?? "",
    is_pinned: body.is_pinned ?? false,
  };

  const { data, error } = await supabaseServer
    .from("notes")
    .insert(row)
    .select("*")
    .single();
  if (error) {
    console.error("[api/notes POST]", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ note: data });
}
