import "server-only";

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth, requireModuleAccess , requireModuleAction} from "@/lib/server/auth";

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
  const deny = await requireModuleAction(auth, "Accounts", "edit");
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
  const deny = await requireModuleAction(auth, "Accounts", "delete");
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
  const deny = await requireModuleAction(auth, "Accounts", "create");
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

/* PATCH — set the HIDDEN-MODULE set for this account in one call.
   Body: { hidden: string[] }

   The Accounts UI has a simple "which apps can this person not see" switch,
   and it used to implement that in the BROWSER: read the overrides, diff them,
   upsert the additions, delete the removals — four anon-key statements against
   `account_permission_overrides`, a table with RLS on and NO policy, so it
   could not read or write a single row. The switch did nothing.

   It is a DIFF, deliberately, not the full replace POST does: an account may
   carry overrides that have nothing to do with visibility (can_create,
   can_edit, data_scope), and replacing the set would silently drop them. */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: accountId } = await params;
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAction(auth, "Accounts", "edit");
  if (deny) return deny;
  const guard = await guardAccountInTenant(accountId, auth.tenant_id);
  if (guard) return guard;

  const body = (await req.json().catch(() => null)) as { hidden?: unknown } | null;
  if (!Array.isArray(body?.hidden) || body.hidden.some((m) => typeof m !== "string")) {
    return NextResponse.json({ error: "hidden must be an array of module keys" }, { status: 400 });
  }
  const hidden = [...new Set(body.hidden as string[])].filter(Boolean);

  const { data: current, error: readErr } = await supabaseServer
    .from("account_permission_overrides")
    .select("module_key, can_view")
    .eq("account_id", accountId);
  if (readErr) {
    console.error("[api/accounts/permission-overrides PATCH read]", readErr.message);
    return NextResponse.json({ error: readErr.message }, { status: 500 });
  }
  const existingHidden = ((current ?? []) as { module_key: string; can_view: boolean | null }[])
    .filter((r) => r.can_view === false)
    .map((r) => r.module_key);

  const toAdd = hidden.filter((m) => !existingHidden.includes(m));
  const toRemove = existingHidden.filter((m) => !hidden.includes(m));

  if (toAdd.length > 0) {
    const { error } = await supabaseServer
      .from("account_permission_overrides")
      .upsert(
        toAdd.map((m) => ({
          account_id: accountId,
          module_key: m,
          access_level: "none",
          can_view: false,
          can_create: false,
          can_edit: false,
          can_delete: false,
          data_scope: "own",
        })),
        { onConflict: "account_id,module_key" },
      );
    if (error) {
      console.error("[api/accounts/permission-overrides PATCH add]", error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  if (toRemove.length > 0) {
    const { error } = await supabaseServer
      .from("account_permission_overrides")
      .delete()
      .eq("account_id", accountId)
      .in("module_key", toRemove);
    if (error) {
      console.error("[api/accounts/permission-overrides PATCH remove]", error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  return NextResponse.json({ ok: true, hidden, added: toAdd.length, removed: toRemove.length });
}
