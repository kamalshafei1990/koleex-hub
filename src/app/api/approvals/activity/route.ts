import "server-only";

import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/server/auth";
import { listActivity, type ApprovalEntity } from "@/lib/approvals";

export async function GET(req: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const url = new URL(req.url);
  const entity = url.searchParams.get("entity") as ApprovalEntity | null;
  const entityId = url.searchParams.get("entityId");
  const limit = Number(url.searchParams.get("limit")) || 50;
  const rows = await listActivity(auth.tenant_id, {
    entity: entity ?? undefined, entityId: entityId ?? undefined, limit,
  });
  return NextResponse.json({ items: rows });
}
