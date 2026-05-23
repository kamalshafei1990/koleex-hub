import "server-only";

/* ===========================================================================
   GET /api/inventory/audit-log?entity_type=movement&entity_id=…

   Returns the audit log entries for a specific entity. Used inline in
   the movement detail drawer (Scope 8 / Scope 9).
   ========================================================================== */

import { NextResponse } from "next/server";
import { requireAuth, requireModuleAccess } from "@/lib/server/auth";
import {
  listInventoryAuditForEntity,
  type InventoryAuditEntity,
} from "@/lib/inventory/audit";

const ALLOWED: InventoryAuditEntity[] = ["movement", "profile", "warehouse"];

export async function GET(req: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAccess(auth, "Inventory");
  if (deny) return deny;

  const url = new URL(req.url);
  const entityType = url.searchParams.get("entity_type") as InventoryAuditEntity | null;
  const entityId = url.searchParams.get("entity_id");
  const limitRaw = Number(url.searchParams.get("limit"));
  const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(limitRaw, 200) : 50;

  if (!entityType || !ALLOWED.includes(entityType) || !entityId) {
    return NextResponse.json(
      { error: "entity_type and entity_id required" },
      { status: 400 },
    );
  }

  const entries = await listInventoryAuditForEntity(auth.tenant_id, entityType, entityId, limit);
  return NextResponse.json({ entries });
}
