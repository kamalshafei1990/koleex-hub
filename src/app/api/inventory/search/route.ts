import "server-only";

/* ===========================================================================
   GET /api/inventory/search?q=...
   INV-H5A — global inventory search across items / serials / batches /
   transfers / returns / movements. Tenant-scoped, parallel queries, capped.
   ========================================================================== */

import { NextResponse } from "next/server";
import { requireAuth, requireModuleAccess } from "@/lib/server/auth";
import { inventoryGlobalSearch } from "@/lib/inventory/queries";

export async function GET(req: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAccess(auth, "Inventory");
  if (deny) return deny;

  const q = (new URL(req.url).searchParams.get("q") ?? "").trim();
  try {
    const results = await inventoryGlobalSearch(auth.tenant_id, q);
    return NextResponse.json({ q, results });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
