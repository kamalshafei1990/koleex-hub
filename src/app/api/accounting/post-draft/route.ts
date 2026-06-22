import "server-only";

/* ===========================================================================
   POST /api/accounting/post-draft
   Body: { entry_id: string }

   Promotes a drafted journal entry to posted. The entry must:
     · belong to the caller's tenant
     · currently be in status='draft'
     · be balanced (the DB rejects unbalanced posts)

   On success the operational source row (looked up via the entry's
   source_type / source_id) flips to accounting_status='posted' with
   accounting_posted_at = now().

   On failure the source row flips to accounting_status='failed' and
   accounting_last_error is populated so the queue can show a retry
   button with the original message.
   ========================================================================== */

import { NextResponse } from "next/server";
import { requireAuth, requireModuleAccess , requireModuleAction} from "@/lib/server/auth";
import { postDraftedEntry } from "@/lib/accounting/posting";

interface Body {
  entry_id?: string;
}

export async function POST(req: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAction(auth, "Finance", "create");
  if (deny) return deny;

  const body = (await req.json().catch(() => ({}))) as Body;
  if (!body.entry_id) return NextResponse.json({ error: "entry_id required" }, { status: 400 });

  const ctx = { tenantId: auth.tenant_id, postedByAccountId: auth.account_id };
  const res = await postDraftedEntry(ctx, body.entry_id);
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: res.code ?? 500 });
  return NextResponse.json(res);
}
