import "server-only";

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth, requireModuleAccess } from "@/lib/server/auth";

/* GET    — list overrides for this account
   PUT    — upsert a single override (body: AccountPermissionOverrideInsert)
   DELETE — remove a single override (body: { module_key })
   POST   — replace the full set of overrides (body: { overrides: [] })

   Requires "Accounts" module permission AND the target account must
   live in the caller's tenant — otherwise an admin on tenant A could
   mutate overrides on tenant B's accounts just by guessing the id. */

/** Verify the account belongs to the caller's tenant. Returns null if
 *  OK, or a 404 NextResponse otherwise — call sites early-return on
 *  non-null. */
async function guardAccountInTenant(
  accountId: string,
  tenantId: string | null,
): Promise<NextResponse | null> {
  let q = supabaseServer.from("accounts").select("id").eq("id", accountId);
  if (tenantId) q = q.eq("tenant_id", tenantId);
  const { data } = await q.maybeSingle();
  if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return null;
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: accountId } = await params;
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAccess(auth, "Accounts");
  if (deny) return deny;
  const guard = await guardAccountInTenant(accountId, auth.tenant_id);
  if (guard) return guard;

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
  const guard = await guardAccountInTenant(accountId, auth.tenant_id);
  if (guard) return guard;

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
  const guard = await guardAccountInTenant(accountId, auth.tenant_id);
  if (guard) return guard;

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
  const guard = await guardAccountInTenant(accountId, auth.tenant_id);
  if (guard) return guard;

  const { overrides } = (await req.json()) as {
    overrides: Array<Record<string, unknown>>;
  };

  /* Atomic replace:
     Previously this route wiped existing overrides then re-inserted,
     which left a window (on crash / slow insert) where the user had
     NO overrides — a privilege escalation if a hide-override was
     being maintained.
     Now: upsert every supplied row by (account_id, module_key), then
     delete only overrides whose module_key is NOT in the submitted
     set. If the submitted set is empty the wipe is a single statement,
     so there's no intermediate state either way. */

  const rows = (overrides ?? []).map((o) => ({
    ...o,
    account_id: accountId,
  }));
  const submittedKeys = rows
    .map((r) => (r as { module_key?: unknown }).module_key)
    .filter((k): k is string => typeof k === "string" && k.length > 0);

  if (rows.length > 0) {
    const { error: upErr } = await supabaseServer
      .from("account_permission_overrides")
      .upsert(rows, { onConflict: "account_id,module_key" });
    if (upErr) {
      console.error(
        "[api/accounts/[id]/permission-overrides POST upsert]",
        upErr.message,
      );
      return NextResponse.json({ error: upErr.message }, { status: 500 });
    }
  }

  // Remove overrides that are no longer in the submitted set.
  let del = supabaseServer
    .from("account_permission_overrides")
    .delete()
    .eq("account_id", accountId);
  if (submittedKeys.length > 0) {
    del = del.not(
      "module_key",
      "in",
      `(${submittedKeys.map((k) => `"${k.replace(/"/g, '""')}"`).join(",")})`,
    );
  }
  const { error: delErr } = await del;
  if (delErr) {
    console.error(
      "[api/accounts/[id]/permission-overrides POST prune]",
      delErr.message,
    );
    return NextResponse.json({ error: delErr.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
