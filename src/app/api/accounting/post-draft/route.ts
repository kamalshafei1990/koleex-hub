import "server-only";

/* POST /api/accounting/post-draft   { entry_id }
   Promotes a drafted journal entry to posted: the entry must belong to the
   caller's tenant, be a draft, balance in base currency and fall in an
   open period (the database asserts all four). Committing to the ledger
   is a Finance "edit" action — drafting only needs "create". */

import { NextResponse } from "next/server";
import { requireAuth, requireModuleAction } from "@/lib/server/auth";
import { postDraftedEntry } from "@/lib/accounting/posting";

export async function POST(req: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAction(auth, "Finance", "edit");
  if (deny) return deny;

  const body = (await req.json().catch(() => ({}))) as { entry_id?: unknown };
  if (typeof body.entry_id !== "string" || !body.entry_id) return NextResponse.json({ error: "entry_id required" }, { status: 400 });
  const res = await postDraftedEntry({ tenantId: auth.tenant_id, postedByAccountId: auth.account_id }, body.entry_id);
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: res.code ?? 500 });
  return NextResponse.json(res);
}
