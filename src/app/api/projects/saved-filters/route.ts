import "server-only";

/* /api/projects/saved-filters — the caller's saved task filter sets.

   Stored in the EXISTING per-user mechanism: accounts.preferences (JSONB),
   key `projects_saved_filters`, written through mergeAccountPrefs (the
   atomic account_prefs_merge RPC — a top-level key replace, so no other
   preference slice can be clobbered). No new table.

   GET → { filters: SavedTaskFilter[] }
   PUT { filters: SavedTaskFilter[] } → replaces the whole list (max 30).

   Always the caller's own account — there is no id parameter. */

import { NextResponse } from "next/server";
import { requireAuth, requireModuleAccess } from "@/lib/server/auth";
import { supabaseServer } from "@/lib/server/supabase-server";
import { mergeAccountPrefs } from "@/lib/server/ai/security/account-prefs";
import { UUID_RE } from "@/lib/server/project-access";

const KEY = "projects_saved_filters";
const STATUSES = ["open", "done", "cancelled", "all"];
const PRIORITIES = ["low", "normal", "high", "urgent", "all"];
const SCOPES = ["mine", "all", "project"];

interface SavedTaskFilter {
  id: string;
  name: string;
  scope: string;
  assignee: string | null;
  tag: string | null;
  status: string;
  priority: string;
  search: string;
  overdue: boolean;
}

function clean(raw: unknown): SavedTaskFilter | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const id = typeof r.id === "string" && /^[A-Za-z0-9_-]{1,64}$/.test(r.id) ? r.id : null;
  const name = typeof r.name === "string" ? r.name.trim().slice(0, 60) : "";
  if (!id || !name) return null;
  const uuidOrNull = (v: unknown) => (typeof v === "string" && UUID_RE.test(v) ? v : null);
  return {
    id,
    name,
    scope: SCOPES.includes(String(r.scope)) ? String(r.scope) : "all",
    assignee: uuidOrNull(r.assignee),
    tag: uuidOrNull(r.tag),
    status: STATUSES.includes(String(r.status)) ? String(r.status) : "open",
    priority: PRIORITIES.includes(String(r.priority)) ? String(r.priority) : "all",
    search: typeof r.search === "string" ? r.search.slice(0, 200) : "",
    overdue: r.overdue === true,
  };
}

export async function GET() {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAccess(auth, "Projects");
  if (deny) return deny;
  const { data, error } = await supabaseServer
    .from("accounts")
    .select("preferences")
    .eq("id", auth.account_id)
    .maybeSingle();
  if (error) {
    console.error("[api/projects/saved-filters GET]", error.message);
    return NextResponse.json({ error: "Failed to load saved filters" }, { status: 500 });
  }
  const prefs = ((data as { preferences: Record<string, unknown> | null } | null)?.preferences ?? {}) as Record<string, unknown>;
  const list = Array.isArray(prefs[KEY]) ? (prefs[KEY] as unknown[]) : [];
  return NextResponse.json({ filters: list.map(clean).filter(Boolean) });
}

export async function PUT(req: Request) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAccess(auth, "Projects");
  if (deny) return deny;
  const body = (await req.json().catch(() => null)) as { filters?: unknown } | null;
  if (!Array.isArray(body?.filters) || body!.filters.length > 30) {
    return NextResponse.json({ error: "Invalid filters" }, { status: 400 });
  }
  const filters = (body!.filters as unknown[]).map(clean);
  if (filters.some((f) => f === null)) return NextResponse.json({ error: "Invalid filter" }, { status: 400 });
  const merged = await mergeAccountPrefs(auth.account_id, { [KEY]: filters });
  if (merged === null) return NextResponse.json({ error: "Could not save filters" }, { status: 500 });
  return NextResponse.json({ filters });
}
