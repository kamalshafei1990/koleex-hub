import "server-only";

/* GET /api/marketing/products?space=&q= — ACTIVE products whose name matches,
   for the composer's "write from a product" (owner rule: pickers show active
   products only). Internal accounts, "view" on the space. Names only. */

import { NextResponse, type NextRequest } from "next/server";
import { requireAuth, requireModuleAction } from "@/lib/server/auth";
import { requireInternalUser } from "@/lib/server/ai/require-internal";
import { searchActiveProducts } from "@/lib/server/marketing/captions";
import { SPACE_MODULE, asSpace } from "@/lib/marketing/spaces";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const notInternal = requireInternalUser(auth);
  if (notInternal) return notInternal;
  const space = asSpace(req.nextUrl.searchParams.get("space"));
  const denied = await requireModuleAction(auth, SPACE_MODULE[space], "view");
  if (denied) return denied;
  try {
    return NextResponse.json({ results: await searchActiveProducts(req.nextUrl.searchParams.get("q") ?? "") }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (e) {
    console.error("[api/marketing/products]", e instanceof Error ? e.message : String(e));
    return NextResponse.json({ error: "Could not search the products." }, { status: 500 });
  }
}
