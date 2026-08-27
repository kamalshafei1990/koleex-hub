import "server-only";

/* GET /api/super-admin/monitor — KPI counters + live online users.
   Super-Admin only. Polled by the activity panel (~8s). */

import { NextResponse } from "next/server";
import { getServerAuth } from "@/lib/server/auth";
import { kpis, onlinePeople } from "@/lib/server/super-admin";

export async function GET() {
  const auth = await getServerAuth();
  if (!auth) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  if (!auth.is_super_admin) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  /* People, not sessions: the panel's question is "who is on and what are
     they doing", and a person with a phone and a laptop is one person. The
     sessions ride inside each row for the drawer / device badge. */
  const [k, people] = await Promise.all([kpis(), onlinePeople()]);
  return NextResponse.json({ kpis: k, people }, { headers: { "Cache-Control": "no-store" } });
}
