import "server-only";

/* GET /api/accounts — list accounts in the caller's tenant.
   Requires the "Accounts" module permission. Super Admin sees every account
   in whichever tenant ctx.tenant_id points to (via TenantPicker). */

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth, requireModuleAccess } from "@/lib/server/auth";

export async function GET() {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAccess(auth, "Accounts");
  if (deny) return deny;

  const { data, error } = await supabaseServer
    .from("accounts")
    .select(
      // Explicit allowlist — password_hash (and any future secrets) stay
      // server-side only. Keeping * here used to leak the hash to every
      // page that listed accounts.
      `id, tenant_id, username, login_email, status, user_type,
       avatar_url, person_id, company_id, contact_id, role_id,
       is_super_admin, two_factor_enabled, force_password_change,
       last_login_at, created_at, updated_at, preferences`,
    )
    .eq("tenant_id", auth.tenant_id)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[api/accounts]", error.message);
    return NextResponse.json({ error: "Failed to load accounts" }, { status: 500 });
  }
  return NextResponse.json({ accounts: data ?? [] }, {
    headers: { "Cache-Control": "private, max-age=5, stale-while-revalidate=60" },
  });
}

/* POST /api/accounts — create a new account.
   Body mirrors accounts-admin.createAccount:
     { ...AccountInsert, temporary_password?: string, preferences?: obj }
   The temporary_password is hashed server-side (same scheme as the
   legacy path). tenant_id is enforced from the session. */

function hashTempPassword(plain: string): string {
  // Matches the hashing used in accounts-admin.ts / auth/signin.
  return `tmp$${Buffer.from(plain, "utf8").toString("base64")}`;
}

export async function POST(req: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAccess(auth, "Accounts");
  if (deny) return deny;

  const body = (await req.json()) as Record<string, unknown> & {
    temporary_password?: string;
    preferences?: Record<string, unknown>;
  };
  const { temporary_password, preferences, ...rest } = body;

  // Reject empty-string passwords up-front. Previously hashTempPassword("")
  // produced "tmp$" — a deterministic "empty password" hash that any
  // attacker who knew the scheme could sign in against. If the admin
  // wants to create an account without a password they must omit the
  // field entirely (null password_hash disables sign-in cleanly).
  const trimmedTmp = temporary_password?.trim();
  if (temporary_password !== undefined && !trimmedTmp) {
    return NextResponse.json(
      { error: "Temporary password must not be empty" },
      { status: 400 },
    );
  }

  const payload = {
    ...rest,
    tenant_id: auth.tenant_id, // server-side truth
    password_hash: trimmedTmp ? hashTempPassword(trimmedTmp) : null,
    force_password_change: true,
    preferences: preferences ?? {},
  };

  /* Defensive: accounts.role_id has a FK → `roles.id`, but role
     templates (e.g. the ones saved from AccessRightsTab) historically
     only land in `koleex_roles`. If the admin picked a role that
     exists in koleex_roles but not roles, the insert below fails with
     a FK violation ("accounts_role_id_fkey"). Detect that and mirror
     the row into `roles` first. Matches the same mirror that POST
     /api/roles now does on creation — this covers older orphans. */
  const roleId = (payload as { role_id?: unknown }).role_id;
  if (typeof roleId === "string" && roleId) {
    const [{ data: rolesHit }, { data: koleexHit }] = await Promise.all([
      supabaseServer.from("roles").select("id").eq("id", roleId).maybeSingle(),
      supabaseServer
        .from("koleex_roles")
        .select("id, name, description, is_super_admin, can_view_private")
        .eq("id", roleId)
        .maybeSingle(),
    ]);
    if (!rolesHit && koleexHit) {
      const k = koleexHit as {
        id: string;
        name: string;
        description: string | null;
        is_super_admin: boolean;
        can_view_private: boolean;
      };
      const slug =
        (k.name || `role_${k.id.slice(0, 8)}`)
          .trim()
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "_")
          .replace(/^_+|_+$/g, "")
          .slice(0, 48) || `role_${k.id.slice(0, 8)}`;
      const { error: syncErr } = await supabaseServer.from("roles").upsert(
        {
          id: k.id,
          slug,
          name: k.name,
          description: k.description,
          scope: "internal",
          is_super_admin: k.is_super_admin,
          can_view_private: k.can_view_private,
        },
        { onConflict: "id" },
      );
      if (syncErr) {
        console.error("[api/accounts POST] roles-sync failed:", syncErr.message);
      }
    }
  }

  const { data, error } = await supabaseServer
    .from("accounts")
    .insert(payload)
    .select("*")
    .single();
  if (error) {
    console.error("[api/accounts POST]", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  // Strip password_hash before returning — callers never need it.
  const safe: Record<string, unknown> = { ...(data as Record<string, unknown>) };
  delete safe.password_hash;
  return NextResponse.json({ account: safe });
}
