import "server-only";

/* POST /api/super-admin/session/revoke — force-logout a presence session.

   Marks the app_sessions row revoked. The target's client heartbeat detects
   the revoked status on its next ping (≤30s) and signs itself out. Because
   Koleex uses a custom cookie session (not Supabase Auth), this is the correct
   feasible mechanism — see docs. Super-Admin only; logged to activity feed. */

import { NextResponse } from "next/server";
import { getServerAuth } from "@/lib/server/auth";
import { revokeSession } from "@/lib/server/super-admin";
import { logActivity, requestMeta } from "@/lib/server/activity";

export async function POST(req: Request) {
  const auth = await getServerAuth();
  if (!auth) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  if (!auth.is_super_admin) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  let body: { sessionId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad_body" }, { status: 400 });
  }
  if (!body.sessionId) return NextResponse.json({ error: "missing_session" }, { status: 400 });

  const actor = auth.real_account_id ?? auth.account_id;
  const result = await revokeSession(body.sessionId, actor);

  if (result.ok && result.account_id) {
    await logActivity({
      account_id: result.account_id,
      tenant_id: auth.tenant_id,
      event_type: "session_revoked",
      module: "Super Admin",
      title: "Session force-logged-out by admin",
      severity: "warning",
      meta: requestMeta(req),
      metadata: { revoked_by: actor, session_id: body.sessionId },
    });
  }
  return NextResponse.json({ ok: result.ok });
}
