import "server-only";

/* /api/visual-registry/coverage?scope=division|category|subcategory&id=... → deterministic coverage + intelligence. */

import { NextResponse } from "next/server";
import { requireAuth, requireModuleAccess } from "@/lib/server/auth";
import { gatherScope } from "@/lib/visual-library/registry-coverage";

export async function GET(req: Request) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAccess(auth, "Database");
  if (deny) return deny;
  const url = new URL(req.url);
  const scope = (url.searchParams.get("scope") ?? "").trim();
  const id = (url.searchParams.get("id") ?? "").trim();
  if (!["division", "category", "subcategory"].includes(scope) || !id) {
    return NextResponse.json({ error: "scope (division|category|subcategory) + id required" }, { status: 400 });
  }
  const result = await gatherScope(auth.tenant_id, scope as "division" | "category" | "subcategory", id);
  if (!result) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(result);
}
