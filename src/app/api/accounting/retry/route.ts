import "server-only";

/* POST /api/accounting/retry   { kind, source_id }
   Recovers a failed or stuck source: posts its draft when one exists,
   otherwise rebuilds the entry from the current source row and posts it.
   Committing to the ledger is a Finance "edit" action. */

import { NextResponse } from "next/server";
import { requireAuth, requireModuleAction } from "@/lib/server/auth";
import { retryRecognition, isSourceKind } from "@/lib/accounting/posting";

export async function POST(req: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAction(auth, "Finance", "edit");
  if (deny) return deny;

  const body = (await req.json().catch(() => ({}))) as { kind?: unknown; source_id?: unknown };
  if (!isSourceKind(body.kind) || typeof body.source_id !== "string" || !body.source_id) {
    return NextResponse.json({ error: "kind + source_id required" }, { status: 400 });
  }
  const res = await retryRecognition({ tenantId: auth.tenant_id, postedByAccountId: auth.account_id }, body.kind, body.source_id);
  if (!res.ok) return NextResponse.json({ error: res.error, details: res.details }, { status: res.code ?? 500 });
  return NextResponse.json(res);
}
