import "server-only";

/* POST /api/me/password — self-service password change.

   The user changes THEIR OWN password only (account id comes from the signed
   session, never the body). Verifies the current password, then re-hashes the
   new one with the canonical Argon2id write path. No new table.

   Guards:
     · Must be signed in.
     · Blocked while a Super Admin is "viewing as" someone (read-only preview).
     · Current password must verify.
     · New password: min 8 chars, must differ from current.
   Never logs or returns password material; the audit entry records only that
   a change happened. */

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { getServerAuth } from "@/lib/server/auth";
import { verifyPassword, hashForWrite } from "@/lib/server/password";
import { logAudit } from "@/lib/server/audit";

const MIN_LENGTH = 8;

export async function POST(req: Request) {
  const auth = await getServerAuth();
  if (!auth) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  if (auth.viewing_as) {
    return NextResponse.json(
      { error: "Read-only while viewing as another user. Exit view-as to change a password." },
      { status: 403 },
    );
  }

  let body: { current?: string; next?: string };
  try {
    body = (await req.json()) as { current?: string; next?: string };
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  const current = String(body.current ?? "");
  const next = String(body.next ?? "");

  if (next.length < MIN_LENGTH) {
    return NextResponse.json({ error: `New password must be at least ${MIN_LENGTH} characters.` }, { status: 400 });
  }
  if (next === current) {
    return NextResponse.json({ error: "New password must be different from the current one." }, { status: 400 });
  }

  /* Load the current hash for THIS account only. */
  const { data: acct, error: readErr } = await supabaseServer
    .from("accounts")
    .select("password_hash, password_algo")
    .eq("id", auth.account_id)
    .maybeSingle();
  if (readErr) {
    console.error("[me/password] read:", readErr.message);
    return NextResponse.json({ error: "Couldn't verify your account" }, { status: 500 });
  }

  const verdict = await verifyPassword(
    current,
    (acct as { password_hash?: string | null } | null)?.password_hash,
    (acct as { password_algo?: string | null } | null)?.password_algo,
  );
  if (!verdict.ok) {
    return NextResponse.json({ error: "Your current password is incorrect." }, { status: 401 });
  }

  const { hash, algo } = await hashForWrite(next);
  const { error: updErr } = await supabaseServer
    .from("accounts")
    .update({ password_hash: hash, password_algo: algo, force_password_change: false })
    .eq("id", auth.account_id);
  if (updErr) {
    console.error("[me/password] update:", updErr.message);
    return NextResponse.json({ error: "Couldn't update your password" }, { status: 500 });
  }

  /* Audit only — no password material is ever stored. */
  try {
    await logAudit({
      auth,
      action_type: "password_changed",
      entity_type: "account",
      entity_id: auth.account_id,
      entity_label: `@${auth.username}`,
      severity: "warning",
      module: "Settings",
      route: "/api/me/password",
      req,
    });
  } catch { /* best-effort */ }

  return NextResponse.json({ ok: true });
}
