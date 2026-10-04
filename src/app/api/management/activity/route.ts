import "server-only";

/* Position history — the org chart's paper trail.

   GET  ?position_id=…   history for one position: the changes filed under
                         it, and the moves that left it or arrived at it
   GET  ?limit=50        the most recent changes across the tenant
   POST { ...row }       add an entry (super admin)

   koleex_position_history is service-role-only, so the browser reads it
   through here. Who may read it: the Management app's own people (26 Sep
   2026) — it said only "signed in", so any account, a customer's login
   included, could read who moved where and when. Every row carries who made
   the change and that person's name (changed_by_name), read here.

   A row is always the table's own columns (lib/management/position-history):
   the POST used to add a column the table did not have, and every insert
   through it failed. */

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth, requireModuleAccess } from "@/lib/server/auth";
import { historyFromClient } from "@/lib/management/position-history";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Row = Record<string, unknown> & { changed_by_account_id?: string | null };

/** The name of each account that made a change (its person's name, else its username). */
async function withAuthors(rows: Row[]): Promise<Row[]> {
  const ids = Array.from(new Set(rows.map((r) => r.changed_by_account_id).filter((x): x is string => typeof x === "string" && UUID.test(x))));
  if (!ids.length) return rows;
  const { data: accts } = await supabaseServer.from("accounts").select("id, username, person_id").in("id", ids);
  const list = (accts ?? []) as Array<{ id: string; username: string | null; person_id: string | null }>;
  const persons = list.map((a) => a.person_id).filter((p): p is string => !!p);
  const { data: people } = persons.length ? await supabaseServer.from("people").select("id, full_name").in("id", persons) : { data: [] };
  const personName = new Map(((people ?? []) as Array<{ id: string; full_name: string | null }>).map((p) => [p.id, p.full_name]));
  const name = new Map(list.map((a) => [a.id, (a.person_id && personName.get(a.person_id)) || a.username || null]));
  return rows.map((r) => ({ ...r, changed_by_name: (r.changed_by_account_id && name.get(r.changed_by_account_id)) || null }));
}

export async function GET(req: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  /* The Management app's own right (a super admin always passes). */
  const deny = await requireModuleAccess(auth, "Management");
  if (deny) return deny;

  const url = new URL(req.url);
  const positionId = url.searchParams.get("position_id");
  if (positionId !== null && !UUID.test(positionId)) return NextResponse.json({ error: "position_id must be an id" }, { status: 400 });
  const limitRaw = Number(url.searchParams.get("limit") ?? 50);
  const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(1, limitRaw), 200) : 50;

  let q = supabaseServer
    .from("koleex_position_history")
    .select("*")
    .order("created_at", { ascending: false });
  /* A transfer is ONE row (from → to): both positions' histories find it. */
  if (positionId) q = q.or(`position_id.eq.${positionId},from_position_id.eq.${positionId},to_position_id.eq.${positionId}`).limit(500);
  else q = q.limit(limit);

  const { data, error } = await q;
  if (error) {
    console.error("[api/management/activity GET]", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ history: await withAuthors((data ?? []) as Row[]) });
}

export async function POST(req: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  if (!auth.is_super_admin) {
    return NextResponse.json({ error: "Super admin required." }, { status: 403 });
  }
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: "Body required." }, { status: 400 });

  /* Who made the change is decided here, from the session — an audit row whose
     author the client can choose is not an audit row. Only the table's own
     fields travel; anything else in the body is dropped. */
  const row = historyFromClient(body, auth.account_id);
  if ("error" in row) return NextResponse.json({ error: row.error }, { status: 400 });
  const { error } = await supabaseServer.from("koleex_position_history").insert(row);
  if (error) {
    console.error("[api/management/activity POST]", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
