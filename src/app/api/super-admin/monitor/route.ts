import "server-only";

/* GET /api/super-admin/monitor — KPI counters + live online users.
   Super-Admin only. Polled by the activity panel (~8s). */

import { NextResponse } from "next/server";
import { getServerAuth } from "@/lib/server/auth";
import { kpis, onlinePeople } from "@/lib/server/super-admin";
import { supabaseServer } from "@/lib/server/supabase-server";

/* ── RETENTION for activity_events ──────────────────────────────────────────
   17,607 rows had piled up since June with nothing ever deleting one — the
   same disease the inbox had. Presence beats and page views older than 90
   days carry no monitoring value: usage_daily holds the accurate hours, and
   audit_logs (untouched here — it is the compliance record) holds the
   actions. Throttled to once an hour per server instance and fired from the
   SA-only monitor load, fire-and-forget — the 8-second poll never waits. */
let lastPrune = 0;
function pruneActivityEvents(): void {
  if (Date.now() - lastPrune < 3600_000) return;
  lastPrune = Date.now();
  const cutoff = new Date(Date.now() - 90 * 86400_000).toISOString();
  void supabaseServer
    .from("activity_events")
    .delete()
    .lt("created_at", cutoff)
    .then(({ error }) => { if (error) console.error("[monitor prune]", error.message); });
}

export async function GET() {
  const auth = await getServerAuth();
  if (!auth) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  if (!auth.is_super_admin) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  /* People, not sessions: the panel's question is "who is on and what are
     they doing", and a person with a phone and a laptop is one person. The
     sessions ride inside each row for the drawer / device badge. */
  pruneActivityEvents();
  const [k, people] = await Promise.all([kpis(), onlinePeople()]);
  return NextResponse.json({ kpis: k, people }, { headers: { "Cache-Control": "no-store" } });
}
