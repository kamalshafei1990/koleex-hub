import "server-only";

/* ===========================================================================
   POST /api/accounting/bulk
     { action: "draft" | "post" | "retry", items: [{ kind, source_id }] }

   The month-end button: draft or post many queue items in one call
   instead of one click per row. Each item is processed independently;
   one failure (a missing FX rate, a closed period) does not stop the
   rest, and the response lists every outcome so the operator sees
   exactly which rows need attention.

   Drafting is a Finance "create" action; posting and retrying commit to
   the ledger and need "edit". Capped at 200 items per call.
   ========================================================================== */

import { NextResponse } from "next/server";
import { requireAuth, requireModuleAction } from "@/lib/server/auth";
import { draftSource, postSource, retryRecognition, isSourceKind, type SourceKind } from "@/lib/accounting/posting";

type Action = "draft" | "post" | "retry";
interface Item { kind: SourceKind; source_id: string }

export async function POST(req: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const body = (await req.json().catch(() => ({}))) as { action?: unknown; items?: unknown };
  const action = body.action as Action;
  if (action !== "draft" && action !== "post" && action !== "retry") {
    return NextResponse.json({ error: "action must be draft | post | retry" }, { status: 400 });
  }
  const deny = await requireModuleAction(auth, "Finance", action === "draft" ? "create" : "edit");
  if (deny) return deny;

  const raw = Array.isArray(body.items) ? body.items : [];
  const items: Item[] = [];
  for (const it of raw) {
    const o = it as { kind?: unknown; source_id?: unknown };
    if (isSourceKind(o.kind) && typeof o.source_id === "string" && o.source_id) items.push({ kind: o.kind, source_id: o.source_id });
  }
  if (items.length === 0) return NextResponse.json({ error: "items required" }, { status: 400 });
  if (items.length > 200) return NextResponse.json({ error: "At most 200 items per call" }, { status: 400 });

  const ctx = { tenantId: auth.tenant_id, postedByAccountId: auth.account_id };
  const run = action === "draft" ? draftSource : action === "post" ? postSource : retryRecognition;

  /* Sequential on purpose: journal numbers are allocated per entry and
     the period lock is checked per entry; a burst of parallel writes
     buys little and makes collisions likelier. */
  const results: Array<{ kind: SourceKind; source_id: string; ok: boolean; journal_no?: string; status?: string; error?: string }> = [];
  for (const it of items) {
    try {
      const r = await run(ctx, it.kind, it.source_id);
      results.push(r.ok
        ? { kind: it.kind, source_id: it.source_id, ok: true, journal_no: r.journal_no, status: r.status }
        : { kind: it.kind, source_id: it.source_id, ok: false, error: r.error });
    } catch (e) {
      results.push({ kind: it.kind, source_id: it.source_id, ok: false, error: e instanceof Error ? e.message : String(e) });
    }
  }
  const succeeded = results.filter((r) => r.ok).length;
  return NextResponse.json({ ok: succeeded === results.length, succeeded, failed: results.length - succeeded, results });
}
