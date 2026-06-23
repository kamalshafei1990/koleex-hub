import "server-only";

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth, requireModuleAccess } from "@/lib/server/auth";

/* GET /api/notes/share-candidates?q=term
   Active accounts in the caller's tenant (excluding self) that a note can be
   shared with. `q` filters by username / email. Service-role read because RLS
   on `accounts` blocks the anon client from listing peers. */

export async function GET(req: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAccess(auth, "Notes");
  if (deny) return deny;

  const url = new URL(req.url);
  const q = url.searchParams.get("q")?.trim() ?? "";

  let query = supabaseServer
    .from("accounts")
    .select("id, username, login_email, avatar_url, role:roles(name)")
    .eq("tenant_id", auth.tenant_id)
    .eq("status", "active")
    .neq("id", auth.account_id)
    .order("username", { ascending: true })
    .limit(50);

  if (q) {
    const term = `%${q}%`;
    query = query.or(`username.ilike.${term},login_email.ilike.${term}`);
  }

  const { data, error } = await query;
  if (error) {
    console.error("[api/notes/share-candidates]", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const accounts = ((data ?? []) as Array<Record<string, unknown>>).map((row) => {
    const roleRel = row.role as { name?: string } | { name?: string }[] | null;
    const roleName = Array.isArray(roleRel) ? roleRel[0]?.name : roleRel?.name;
    return {
      id: row.id as string,
      username: (row.username as string) ?? null,
      login_email: (row.login_email as string) ?? null,
      role: roleName ?? null,
      avatar_url: (row.avatar_url as string) ?? null,
    };
  });

  return NextResponse.json({ accounts });
}
