import "server-only";

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { softDeleteAccount, recordBinEntry } from "@/lib/server/recycle-bin";
import { requireAuth, requireModuleAccess , requireModuleAction} from "@/lib/server/auth";
import { derivePasswordState } from "@/lib/server/password-state";
import { guardAccountAvatarField } from "@/lib/server/persist-account-avatar";

/* GET    /api/accounts/[id] — fetch single account with person, company,
                                 role, employee, overrides joined.
   PATCH  /api/accounts/[id] — update account fields.
   DELETE /api/accounts/[id] — remove account (cascade by DB).

   Guard: "Accounts" module permission. tenant_id can never be rewritten
   by the client (stripped server-side). */

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAccess(auth, "Accounts");
  if (deny) return deny;

  let q = supabaseServer
    .from("accounts")
    .select("*")
    .eq("id", id);
  if (auth.tenant_id) q = q.eq("tenant_id", auth.tenant_id);
  const { data: account, error } = await q.maybeSingle();
  if (error) {
    console.error("[api/accounts/[id] GET]", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!account) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const acc = account as Record<string, unknown>;

  // Parallel join lookups — all via service_role, all tenant-safe.
  const [personRes, companyRes, roleRes, employeeRes, overridesRes, presetRes] =
    await Promise.all([
      acc.person_id
        ? supabaseServer
            .from("people")
            .select("*")
            .eq("id", acc.person_id as string)
            .maybeSingle()
        : Promise.resolve({ data: null }),
      acc.company_id
        ? supabaseServer
            .from("companies")
            .select("*")
            .eq("id", acc.company_id as string)
            .maybeSingle()
        : Promise.resolve({ data: null }),
      acc.role_id
        ? supabaseServer
            .from("koleex_roles")
            .select("*")
            .eq("id", acc.role_id as string)
            .maybeSingle()
        : Promise.resolve({ data: null }),
      supabaseServer
        .from("koleex_employees")
        .select("*")
        .eq("account_id", id)
        .maybeSingle(),
      supabaseServer
        .from("account_permission_overrides")
        .select("*")
        .eq("account_id", id),
      acc.role_id
        ? supabaseServer
            .from("access_presets")
            .select("*")
            .eq("role_id", acc.role_id as string)
            .maybeSingle()
        : Promise.resolve({ data: null }),
    ]);

  // Derive the display-only password state BEFORE stripping the hash, so the
  // Security tab can show the correct status without ever receiving a secret.
  const { password_state, has_password } = derivePasswordState({
    auth_user_id: acc.auth_user_id as string | null | undefined,
    password_hash: acc.password_hash as string | null | undefined,
    password_algo: acc.password_algo as string | null | undefined,
    force_password_change: acc.force_password_change as boolean | null | undefined,
  });

  // Strip password_hash from the response. Every consumer already
  // uses dedicated endpoints for password reset / force-change — the
  // account detail view never needs the hash. The derived enum above
  // replaces any need to inspect the hash client-side.
  const { password_hash: _ph, ...safeAcc } = acc as {
    password_hash?: string;
  } & Record<string, unknown>;

  return NextResponse.json({
    account: {
      ...safeAcc,
      // Safe, display-only password facts (no hash ever):
      password_state,
      has_password,
      person: personRes.data,
      company: companyRes.data,
      role: roleRes.data,
      employee: employeeRes.data,
      overrides: overridesRes.data ?? [],
      preset: presetRes.data,
    },
  });
}

async function existsInTenant(
  id: string,
  tenantId: string | null,
): Promise<boolean> {
  let q = supabaseServer.from("accounts").select("id").eq("id", id);
  if (tenantId) q = q.eq("tenant_id", tenantId);
  const { data } = await q.maybeSingle();
  return data !== null;
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAction(auth, "Accounts", "edit");
  if (deny) return deny;

  if (!(await existsInTenant(id, auth.tenant_id))) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const patch = (await req.json()) as Record<string, unknown>;

  /* An ALLOW-list, not a deny-list.

     This used to delete four keys and write everything else straight through,
     which meant `is_super_admin` was writable by anyone holding Accounts:edit
     — including on their own row. One PATCH and an Admin was a Super Admin.
     A deny-list also silently re-opens every time a column is added, which is
     exactly what would have happened with the reviewer flag below. */
  const EDITABLE = new Set([
    "username", "login_email", "status", "role_id", "person_id", "company_id",
    "contact_id", "internal_notes", "preferences", "avatar_url", "user_type",
    "force_password_change", "two_factor_enabled",
  ]);
  /* Granting a rank, or the right to read other people's membership requests,
     is a Super Admin's call and nobody else's. */
  const SUPER_ADMIN_ONLY = new Set(["is_super_admin", "reviews_membership_requests"]);

  /* The account form posts the WHOLE object on every save, including
     is_super_admin, so a plain "you may not send this key" would 403 an Admin
     for editing somebody's phone number. What is forbidden is CHANGING the
     value — sending back what is already stored is a no-op and is dropped. */
  const guarded = [...SUPER_ADMIN_ONLY].filter((k) => k in patch);
  if (guarded.length > 0 && !auth.is_super_admin) {
    const { data: current } = await supabaseServer
      .from("accounts")
      .select(guarded.join(", "))
      .eq("id", id)
      .maybeSingle();
    const now = (current ?? {}) as Record<string, unknown>;
    const changing = guarded.filter((k) => Boolean(patch[k]) !== Boolean(now[k]));
    if (changing.length > 0) {
      return NextResponse.json(
        { error: `Only a Super Admin can change: ${changing.join(", ")}` },
        { status: 403 },
      );
    }
  }

  for (const key of Object.keys(patch)) {
    if (EDITABLE.has(key)) continue;
    if (SUPER_ADMIN_ONLY.has(key) && auth.is_super_admin) continue;
    delete patch[key];
  }
  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  // Guard: inline base64 avatars go to Storage, never into the column.
  try {
    await guardAccountAvatarField(id, patch);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Avatar upload failed";
    console.error("[api/accounts/[id] PATCH] avatar storage", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  // Belt + braces: filter update by tenant_id too so a race between
  // existsInTenant() and the UPDATE (or a compromised caller) can't
  // mutate rows in another tenant.
  let upd = supabaseServer
    .from("accounts")
    .update(patch)
    .eq("id", id);
  if (auth.tenant_id) upd = upd.eq("tenant_id", auth.tenant_id);
  const { error } = await upd;
  if (error) {
    console.error("[api/accounts/[id] PATCH]", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAction(auth, "Accounts", "delete");
  if (deny) return deny;

  if (!(await existsInTenant(id, auth.tenant_id))) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Safety: never let an admin delete their own account through the API.
  if (id === auth.account_id) {
    return NextResponse.json(
      { error: "Cannot delete your own account" },
      { status: 400 },
    );
  }

  /* RECOVERABLE delete (owner directive): the row is never hard-dropped.
     Snapshot the account + its To-do footprint into the recycle bin,
     sweep that footprint from the live system, and set status='deleted' —
     login blocked, hidden from every list/picker, restorable any time
     from the Recycle Bin. */
  const { data: person } = await supabaseServer
    .from("accounts").select("person_id, username").eq("id", id).maybeSingle();
  let label: string | null = (person?.username as string) ?? null;
  if (person?.person_id) {
    const { data: p } = await supabaseServer
      .from("people").select("full_name").eq("id", person.person_id).maybeSingle();
    if (p?.full_name) label = p.full_name as string;
  }
  const { account, swept } = await softDeleteAccount(id);
  if (!account) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  await recordBinEntry({
    tenantId: auth.tenant_id ?? null,
    kind: "account",
    label,
    accountId: id,
    personId: (account.person_id as string) ?? null,
    deletedBy: auth.account_id ?? null,
    snapshot: { account, swept },
  });
  return NextResponse.json({ ok: true, recoverable: true });
}
