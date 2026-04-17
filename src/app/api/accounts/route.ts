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
    .select("*")
    .eq("tenant_id", auth.tenant_id)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[api/accounts]", error.message);
    return NextResponse.json({ error: "Failed to load accounts" }, { status: 500 });
  }
  return NextResponse.json({ accounts: data ?? [] });
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

  const payload = {
    ...rest,
    tenant_id: auth.tenant_id, // server-side truth
    password_hash: temporary_password
      ? hashTempPassword(temporary_password)
      : null,
    force_password_change: true,
    preferences: preferences ?? {},
  };

  const { data, error } = await supabaseServer
    .from("accounts")
    .insert(payload)
    .select("*")
    .single();
  if (error) {
    console.error("[api/accounts POST]", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ account: data });
}
