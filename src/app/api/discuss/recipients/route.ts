import "server-only";

/* GET /api/discuss/recipients — the people you can start a direct message with.

   accounts/people/roles are service-role-only (P0 security lockdown), so the
   browser anon client can no longer read them directly — which left the Discuss
   "New Direct Message" picker empty ("No results"). This resolves the messageable
   list server-side (service role), scoped to the caller's tenant, gated by
   Discuss module access.

   Returns: { recipients: Array<{ id, username, full_name, avatar_url, role_name }> }. */

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth, requireModuleAccess } from "@/lib/server/auth";

export async function GET() {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAccess(auth, "Discuss");
  if (deny) return deny;

  // Internal, active accounts in the caller's tenant = messageable users.
  let q = supabaseServer
    .from("accounts")
    .select("id, username, avatar_url, person_id, role_id")
    .eq("user_type", "internal")
    .eq("status", "active")
    .order("username");
  if (auth.tenant_id) q = q.eq("tenant_id", auth.tenant_id);
  const { data: accounts, error } = await q;

  if (error) {
    console.error("[api/discuss/recipients]", error.message);
    return NextResponse.json({ error: "Failed to load recipients" }, { status: 500 });
  }
  const rows = (accounts ?? []) as Array<{
    id: string;
    username: string;
    avatar_url: string | null;
    person_id: string | null;
    role_id: string | null;
  }>;
  if (rows.length === 0) return NextResponse.json({ recipients: [] });

  const personIds = rows.map((a) => a.person_id).filter(Boolean) as string[];
  const roleIds = Array.from(new Set(rows.map((a) => a.role_id).filter(Boolean) as string[]));

  const [peopleRes, rolesRes] = await Promise.all([
    personIds.length > 0
      ? supabaseServer.from("people").select("id, full_name, avatar_url").in("id", personIds)
      : Promise.resolve({ data: [] as Array<{ id: string; full_name: string | null; avatar_url: string | null }> }),
    roleIds.length > 0
      ? supabaseServer.from("roles").select("id, name").in("id", roleIds)
      : Promise.resolve({ data: [] as Array<{ id: string; name: string | null }> }),
  ]);

  const personMap = new Map(
    ((peopleRes.data ?? []) as Array<{ id: string; full_name: string | null; avatar_url: string | null }>).map(
      (p) => [p.id, p],
    ),
  );
  const roleMap = new Map(
    ((rolesRes.data ?? []) as Array<{ id: string; name: string | null }>).map((r) => [r.id, r.name]),
  );

  const recipients = rows.map((a) => {
    const person = a.person_id ? personMap.get(a.person_id) : null;
    return {
      id: a.id,
      username: a.username,
      full_name: person?.full_name ?? null,
      avatar_url: a.avatar_url ?? person?.avatar_url ?? null,
      role_name: a.role_id ? roleMap.get(a.role_id) ?? null : null,
    };
  });

  return NextResponse.json(
    { recipients },
    { headers: { "Cache-Control": "private, max-age=30, stale-while-revalidate=300" } },
  );
}
