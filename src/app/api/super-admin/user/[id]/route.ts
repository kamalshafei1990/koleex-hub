import "server-only";

/* GET /api/super-admin/user/[id] — full activity detail for one account. */

import { NextResponse } from "next/server";
import { getServerAuth } from "@/lib/server/auth";
import { userDetail } from "@/lib/server/super-admin";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await getServerAuth();
  if (!auth) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  if (!auth.is_super_admin) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const { id } = await ctx.params;
  if (!id) return NextResponse.json({ error: "missing_id" }, { status: 400 });
  const detail = await userDetail(id);
  return NextResponse.json(detail, { headers: { "Cache-Control": "no-store" } });
}
