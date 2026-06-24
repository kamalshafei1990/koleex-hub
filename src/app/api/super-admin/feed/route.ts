import "server-only";

/* GET /api/super-admin/feed — filtered activity feed (Super-Admin only). */

import { NextResponse } from "next/server";
import { getServerAuth } from "@/lib/server/auth";
import { activityFeed } from "@/lib/server/super-admin";

export async function GET(req: Request) {
  const auth = await getServerAuth();
  if (!auth) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  if (!auth.is_super_admin) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const url = new URL(req.url);
  const q = url.searchParams;
  const rows = await activityFeed({
    account_id: q.get("account") || null,
    module: q.get("module") || null,
    event_type: q.get("event") || null,
    severity: q.get("severity") || null,
    search: q.get("search") || null,
    from: q.get("from") || null,
    to: q.get("to") || null,
    criticalOnly: q.get("critical") === "1",
    before: q.get("before") || null,
    limit: Number(q.get("limit")) || 60,
  });
  return NextResponse.json({ rows }, { headers: { "Cache-Control": "no-store" } });
}
