import { NextResponse, type NextRequest } from "next/server";
import { requireAuth } from "@/lib/server/auth";
import { clearViewAsCookie } from "@/lib/server/session";
import { supabaseServer } from "@/lib/server/supabase-server";

/* ---------------------------------------------------------------------------
   POST /api/auth/view-as/exit

   Clears the koleex_view_as cookie, returning the SA to their own view.
   Idempotent — safe to call even when no view-as is active.
   --------------------------------------------------------------------------- */

export async function POST(req: NextRequest) {
  /* Don't pass `req` — exiting view-as IS a write, but the read-only
     block would prevent the SA from ever exiting. The action itself
     is only meaningful while viewing-as, and the audit row captures it. */
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  /* Capture target before clearing so the audit row knows who was being viewed. */
  const targetAccountId = auth.viewing_as ? auth.account_id : null;
  const actorAccountId = auth.real_account_id ?? auth.account_id;

  await clearViewAsCookie();

  if (targetAccountId) {
    await supabaseServer.from("koleex_security_audit").insert({
      actor_account_id: actorAccountId,
      target_account_id: targetAccountId,
      action: "view_as.exit",
      ip: ipFor(req),
      user_agent: req.headers.get("user-agent") ?? null,
    });
  }

  return NextResponse.json({ ok: true });
}

function ipFor(req: NextRequest): string | null {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]?.trim() ?? null;
  return req.headers.get("x-real-ip");
}
