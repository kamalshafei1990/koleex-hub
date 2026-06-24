import "server-only";

/* GET /api/super-admin/monitor — KPI counters + live online users.
   Super-Admin only. Polled by the activity panel (~8s). */

import { NextResponse } from "next/server";
import { getServerAuth } from "@/lib/server/auth";
import { kpis, onlineUsers } from "@/lib/server/super-admin";

export async function GET() {
  const auth = await getServerAuth();
  if (!auth) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  if (!auth.is_super_admin) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const [k, online] = await Promise.all([kpis(), onlineUsers()]);
  return NextResponse.json({ kpis: k, online }, { headers: { "Cache-Control": "no-store" } });
}
