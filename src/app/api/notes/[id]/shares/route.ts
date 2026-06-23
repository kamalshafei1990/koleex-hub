import "server-only";

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth, requireModuleAccess } from "@/lib/server/auth";
import { getNoteRole, canRead } from "@/lib/server/note-access";

/* GET  /api/notes/[id]/shares — collaborators on a note (any reader may view
                                 the list). Includes the owner + each share.
   POST /api/notes/[id]/shares — owner adds a collaborator
                                 body: { account_id, permission: 'view'|'edit' } */

interface AccountLite {
  id: string;
  username: string | null;
  login_email: string | null;
  role: string | null;
  avatar_url: string | null;
}

async function loadAccounts(ids: string[]): Promise<Map<string, AccountLite>> {
  const map = new Map<string, AccountLite>();
  if (ids.length === 0) return map;
  const { data } = await supabaseServer
    .from("accounts")
    .select("id, username, login_email, avatar_url, role:roles(name)")
    .in("id", ids);
  for (const row of (data ?? []) as Array<Record<string, unknown>>) {
    const roleRel = row.role as { name?: string } | { name?: string }[] | null;
    const roleName = Array.isArray(roleRel) ? roleRel[0]?.name : roleRel?.name;
    map.set(row.id as string, {
      id: row.id as string,
      username: (row.username as string) ?? null,
      login_email: (row.login_email as string) ?? null,
      role: roleName ?? null,
      avatar_url: (row.avatar_url as string) ?? null,
    });
  }
  return map;
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAccess(auth, "Notes");
  if (deny) return deny;

  const access = await getNoteRole(id, auth.account_id);
  if (!canRead(access.role)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { data: shares, error } = await supabaseServer
    .from("note_shares")
    .select("id, shared_with_account_id, shared_by_account_id, permission, created_at")
    .eq("note_id", id)
    .order("created_at", { ascending: true });
  if (error) {
    console.error("[api/notes/[id]/shares GET]", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const rows = shares ?? [];
  const ids = new Set<string>();
  if (access.ownerId) ids.add(access.ownerId);
  for (const s of rows) ids.add(s.shared_with_account_id as string);
  const accounts = await loadAccounts([...ids]);

  const acct = (aid: string | null) => (aid ? accounts.get(aid) ?? null : null);

  return NextResponse.json({
    role: access.role,
    isOwner: access.role === "owner",
    owner: access.ownerId
      ? { account_id: access.ownerId, account: acct(access.ownerId) }
      : null,
    shares: rows.map((s) => ({
      id: s.id,
      account_id: s.shared_with_account_id,
      permission: s.permission,
      created_at: s.created_at,
      account: acct(s.shared_with_account_id as string),
    })),
  });
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAccess(auth, "Notes");
  if (deny) return deny;

  const access = await getNoteRole(id, auth.account_id);
  if (access.role !== "owner") {
    return NextResponse.json({ error: "Only the owner can share this note." }, { status: 403 });
  }

  const body = (await req.json()) as { account_id?: string; permission?: string };
  const accountId = (body.account_id ?? "").trim();
  const permission = body.permission === "view" ? "view" : "edit";
  if (!accountId) {
    return NextResponse.json({ error: "account_id required" }, { status: 400 });
  }
  if (accountId === access.ownerId) {
    return NextResponse.json({ error: "You already own this note." }, { status: 400 });
  }

  // The target must be an active account in the SAME tenant.
  const { data: target } = await supabaseServer
    .from("accounts")
    .select("id, tenant_id, status")
    .eq("id", accountId)
    .maybeSingle();
  if (!target || target.tenant_id !== auth.tenant_id) {
    return NextResponse.json({ error: "Account not found in your organization." }, { status: 404 });
  }

  const { data, error } = await supabaseServer
    .from("note_shares")
    .upsert(
      {
        tenant_id: auth.tenant_id,
        note_id: id,
        shared_with_account_id: accountId,
        shared_by_account_id: auth.account_id,
        permission,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "note_id,shared_with_account_id" },
    )
    .select("id, shared_with_account_id, permission, created_at")
    .single();
  if (error) {
    console.error("[api/notes/[id]/shares POST]", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ share: data });
}
