import "server-only";

/* GET /api/marketing/accounts?space=company|ceo — the connected accounts of
   a space and which server settings are in place (booleans only). Never an
   access key: lib/server/marketing/accounts selects the columns a screen
   may see. Reading needs "view" on the space's module. */

import { NextResponse, type NextRequest } from "next/server";
import { requireAuth, requireModuleAction } from "@/lib/server/auth";
import { listAccounts, marketingSetup } from "@/lib/server/marketing/accounts";
import { SPACE_MODULE, asSpace } from "@/lib/marketing/spaces";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const space = asSpace(req.nextUrl.searchParams.get("space"));
  const denied = await requireModuleAction(auth, SPACE_MODULE[space], "view");
  if (denied) return denied;
  try {
    const accounts = await listAccounts(auth.tenant_id, space);
    return NextResponse.json({ accounts, setup: marketingSetup() }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (e) {
    console.error("[api/marketing/accounts]", e instanceof Error ? e.message : String(e));
    return NextResponse.json({ error: "Could not load the connected accounts." }, { status: 500 });
  }
}
