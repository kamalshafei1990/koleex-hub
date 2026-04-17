import "server-only";

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth, requireModuleAccess } from "@/lib/server/auth";

/* GET    — list overrides for this account
   PUT    — upsert a single override (body: AccountPermissionOverrideInsert)
   DELETE — remove a single override (body: { module_key })
   POST   — replace the full set of overrides (body: { overrides: [] })

   Requires "Accounts" module permission. */

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: accountId } = await params;
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAccess(auth, "Accounts");
  if (deny) return deny;

  const { data, error } = await supabaseServer
    .from("account_permission_overrides")
    .select("*")
    .eq("account_id", accountId);
  if (error) {
    console.error("[api/accounts/[id]/permission-overrides GET]", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ overrides: data ?? [] });
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: accountId } = await params;
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAccess(auth, "Accounts");
  if (deny) return deny;

  const body = (await req.json()) as Record<string, unknown>;
  const payload = { ...body, account_id: accountId };

  const { error } = await supabaseServer
    .from("account_permission_overrides")
    .upsert(payload, { onConflict: "account_id,module_key" });
  if (error) {
    console.error("[api/accounts/[id]/permission-overrides PUT]", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: accountId } = await params;
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAccess(auth, "Accounts");
  if (deny) return deny;

  const { module_key } = (await req.json()) as { module_key: string };

  const { error } = await supabaseServer
    .from("account_permission_overrides")
    .delete()
    .eq("account_id", accountId)
    .eq("module_key", module_key);
  if (error) {
    console.error("[api/accounts/[id]/permission-overrides DELETE]", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: accountId } = await params;
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAccess(auth, "Accounts");
  if (deny) return deny;

  const { overrides } = (await req.json()) as {
    overrides: Array<Record<string, unknown>>;
  };

  // Wipe existing and re-insert — matches replacePermissionOverrides.
  await supabaseServer
    .from("account_permission_overrides")
    .delete()
    .eq("account_id", accountId);

  if (overrides.length > 0) {
    const rows = overrides.map((o) => ({ ...o, account_id: accountId }));
    const { error } = await supabaseServer
      .from("account_permission_overrides")
      .insert(rows);
    if (error) {
      console.error("[api/accounts/[id]/permission-overrides POST]", error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }
  return NextResponse.json({ ok: true });
}
