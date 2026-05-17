import "server-only";

/* ===========================================================================
   POST /api/accounting/journals/[id]/void
   Body: { reason?: string }
   Voids a posted journal entry by posting an atomic reversing entry.
   The original entry is flipped to status='voided' but never deleted.
   ========================================================================== */

import { NextResponse } from "next/server";
import { requireAuth, requireModuleAccess } from "@/lib/server/auth";
import { voidJournalEntry } from "@/lib/accounting/posting";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAccess(auth, "Finance");
  if (deny) return deny;

  const { id } = await ctx.params;
  const body = (await req.json().catch(() => ({}))) as { reason?: string };

  const res = await voidJournalEntry(
    { tenantId: auth.tenant_id, postedByAccountId: auth.account_id },
    id,
    body.reason ?? "void",
  );
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: res.code ?? 500 });
  return NextResponse.json({ reversing_entry_id: res.entry_id, reversing_journal_no: res.journal_no });
}
