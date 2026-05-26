import { NextResponse, type NextRequest } from "next/server";
import { requireAuth } from "@/lib/server/auth";
import { setViewAsCookie } from "@/lib/server/session";
import { supabaseServer } from "@/lib/server/supabase-server";

/* ---------------------------------------------------------------------------
   POST /api/auth/view-as

   Super-admin only. Body: { accountId: string }.
   Mints the `koleex_view_as` cookie so every subsequent request loads
   the target account's permissions + role + tenant. The real session
   stays intact — calling /api/auth/view-as/exit (or letting the 2-hour
   max-age elapse) restores the SA view.

   Read-only enforcement: while the cookie is active, requireAuth(req)
   returns 403 on non-GET requests. This is enforced at the API edge —
   the SA cannot accidentally write data attributed to the target user.

   Audit: every enter/deny is logged to koleex_security_audit.
   --------------------------------------------------------------------------- */

interface Body { accountId?: unknown }

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(req: NextRequest) {
  /* Note: we deliberately DON'T pass `req` to requireAuth — entering
     view-as IS a mutating call, but the read-only block would prevent
     a SA from ever entering it. Authorization is enforced manually
     below via is_super_admin + viewing_as check. */
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  /* If the SA is already viewing as someone else, refuse — they must
     exit first. Prevents a chain of view-as that's hard to audit. */
  if (auth.viewing_as) {
    return NextResponse.json(
      { error: "Already viewing as another user. Exit first." },
      { status: 409 },
    );
  }

  if (!auth.is_super_admin) {
    /* Log the denial — useful for security review. Best-effort:
       audit failures never block the user-facing response. */
    try {
      await supabaseServer.from("koleex_security_audit").insert({
        actor_account_id: auth.account_id,
        action: "view_as.denied",
        ip: ipFor(req),
        user_agent: req.headers.get("user-agent") ?? null,
      });
    } catch {
      /* swallow */
    }
    return NextResponse.json(
      { error: "Only super admins can view as another user." },
      { status: 403 },
    );
  }

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const targetId = typeof body.accountId === "string" ? body.accountId : "";
  if (!UUID_RE.test(targetId)) {
    return NextResponse.json({ error: "accountId must be a UUID" }, { status: 400 });
  }
  if (targetId === auth.account_id) {
    return NextResponse.json(
      { error: "Cannot view as yourself." },
      { status: 400 },
    );
  }

  /* Verify the target exists and is active, scoped to the SA's tenant.
     A SA can only view-as users in their own tenant — viewing other
     tenants is what the TenantPicker is for. */
  const { data: target, error } = await supabaseServer
    .from("accounts")
    .select("id, username, tenant_id, status")
    .eq("id", targetId)
    .eq("tenant_id", auth.tenant_id)
    .maybeSingle();
  if (error) {
    return NextResponse.json({ error: "Lookup failed" }, { status: 500 });
  }
  if (!target) {
    return NextResponse.json(
      { error: "User not found in your tenant." },
      { status: 404 },
    );
  }
  if (target.status !== "active") {
    return NextResponse.json(
      { error: "Target account is not active." },
      { status: 400 },
    );
  }

  await setViewAsCookie(targetId, auth.account_id);

  /* Best-effort audit. Do NOT block the response on it — a slow
     audit insert was previously a major source of "view-as feels
     sluggish" complaints. */
  try {
    await supabaseServer.from("koleex_security_audit").insert({
      actor_account_id: auth.account_id,
      target_account_id: targetId,
      action: "view_as.enter",
      ip: ipFor(req),
      user_agent: req.headers.get("user-agent") ?? null,
      details: { target_username: target.username },
    });
  } catch {
    /* swallow */
  }

  return NextResponse.json({ ok: true, targetAccountId: targetId, targetUsername: target.username });
}

function ipFor(req: NextRequest): string | null {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]?.trim() ?? null;
  return req.headers.get("x-real-ip");
}
