import "server-only";

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth } from "@/lib/server/auth";

/* POST /api/accounts/[id]/password
   Change an account's password. Two modes:
     { password: "plain text" }     → set the provided password
     { generate: true }             → server generates a temporary one
                                      and returns it to the caller.

   The temporary-hash scheme mirrors the /api/auth/signin verification
   path (`tmp$<base64(plain)>`) so this placeholder works without a
   real bcrypt/Supabase-Auth round-trip. When the hash scheme is
   upgraded the only places that need to change are signin's
   verifier and hashTempPassword() in lib/accounts-admin.ts — and
   this route.

   Requires the caller to have Accounts module access (matches the
   force-password-change endpoint). */

function hashTempPassword(plain: string): string {
  return `tmp$${Buffer.from(plain, "utf8").toString("base64")}`;
}

/** Mirror of generateTemporaryPassword() in lib/accounts-admin.ts —
 *  duplicated here so this server route has zero client-bundle
 *  dependencies. Format: Kx-XXXX-XXXXXX (alphanumeric, readable). */
function generateTempPassword(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < 10; i++) {
    out += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return `Kx-${out.slice(0, 4)}-${out.slice(4, 8)}${out.slice(8, 10)}`;
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  /* Password changes are super-admin-only by policy. Regular admins
     with the Accounts module can view/edit every other account field
     but NOT passwords. Self-service password change isn't offered —
     users ask a super admin. */
  if (!auth.is_super_admin) {
    return NextResponse.json(
      { error: "Only a super admin can change passwords." },
      { status: 403 },
    );
  }

  let body: { password?: string; generate?: boolean; forceReset?: boolean };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 },
    );
  }

  let plain = (body.password ?? "").trim();
  const generate = !!body.generate;
  if (!plain && !generate) {
    return NextResponse.json(
      { error: "Provide `password` or `generate: true`" },
      { status: 400 },
    );
  }
  if (generate) plain = generateTempPassword();
  /* Soft strength floor — 8 chars. Real auth will enforce bcrypt
     cost + entropy rules; until then avoid accidental 3-char
     passwords via admin UI typos. */
  if (plain.length < 8) {
    return NextResponse.json(
      { error: "Password must be at least 8 characters" },
      { status: 400 },
    );
  }

  const { error } = await supabaseServer
    .from("accounts")
    .update({
      password_hash: hashTempPassword(plain),
      /* Default: clear force_password_change so the admin who just
         reset the password isn't forcing themselves into a loop.
         Caller can explicitly request force-reset by sending
         { forceReset: true }. */
      force_password_change: body.forceReset === true,
    })
    .eq("id", id)
    .eq("tenant_id", auth.tenant_id);

  if (error) {
    console.error("[api/accounts/[id]/password]", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Audit — don't log the password itself, just that it changed.
  void supabaseServer.from("account_login_history").insert({
    account_id: id,
    event_type: "password_changed",
    metadata: { by_account_id: auth.account_id, generated: generate },
  });

  /* When generated, surface the plain text to the caller so they
     can copy/share it. When the admin provided the password, we
     don't echo it back. */
  return NextResponse.json(
    generate ? { ok: true, password: plain } : { ok: true },
  );
}
