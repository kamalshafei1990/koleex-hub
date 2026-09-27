import "server-only";

/* POST /api/marketing/accounts/[id]/disconnect — deletes the account's
   access key (what the public Data Deletion page promises) and marks it
   disconnected; its posts and numbers stay as history. Needs "edit" on the
   module of the account's own space. */

import { NextResponse } from "next/server";
import { requireAuth, requireModuleAction } from "@/lib/server/auth";
import { accountSpace, disconnectAccount } from "@/lib/server/marketing/accounts";
import { SPACE_MODULE } from "@/lib/marketing/spaces";

export const dynamic = "force-dynamic";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const { id } = await params;
  if (!UUID_RE.test(id)) return NextResponse.json({ error: "Invalid account id." }, { status: 400 });
  try {
    const space = await accountSpace(auth.tenant_id, id);
    if (!space) return NextResponse.json({ error: "Account not found." }, { status: 404 });
    const denied = await requireModuleAction(auth, SPACE_MODULE[space], "edit");
    if (denied) return denied;
    await disconnectAccount(auth.tenant_id, id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[api/marketing/accounts disconnect]", e instanceof Error ? e.message : String(e));
    return NextResponse.json({ error: "Could not disconnect the account." }, { status: 500 });
  }
}
