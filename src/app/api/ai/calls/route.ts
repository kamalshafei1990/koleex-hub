import "server-only";

/* ---------------------------------------------------------------------------
   GET /api/ai/calls — MY past calls, newest first, each by its summary.

   Roadmap D2. The same doors as every conversation read: session, internal
   user, then the caller's own tenant + account. Summaries are read inside
   the caller's own conversation ids. The database narrows to spoken
   assistant rows that carry a heading word; the module decides exactly
   which are summaries. Logs carry counts only.
   --------------------------------------------------------------------------- */

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth } from "@/lib/server/auth";
import { requireInternalUser } from "@/lib/server/ai/require-internal";
import { BUDGETS, consumeBudget, limitMode, subjectFor } from "@/lib/server/ai/security/rate-limit";
import { SUMMARY_HEADINGS } from "@/lib/server/ai/voice/summary";
import { CALLS_SCAN_ROWS, collectCalls, type CallRow } from "@/lib/server/ai/calls";

export const dynamic = "force-dynamic";

const OWNED_CONVERSATIONS_CAP = 500;

export async function GET() {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  {
    const notInternal = requireInternalUser(auth);
    if (notInternal) return notInternal;
  }

  if (limitMode() !== "off") {
    const hit = await consumeBudget(subjectFor.account(auth.account_id), BUDGETS.libraryPerAccount());
    if (!hit.allowed) {
      console.warn(`[ai.calls] ratelimit account count=${hit.count} max=${hit.max} mode=${limitMode()}`);
      if (limitMode() === "enforce") {
        return NextResponse.json(
          { error: "Too many requests just now." },
          { status: 429, headers: { "Retry-After": String(hit.retryAfterSec) } },
        );
      }
    }
  }

  const { data: owned, error: ownedErr } = await supabaseServer
    .from("ai_conversations")
    .select("id, title")
    .eq("tenant_id", auth.tenant_id)
    .eq("account_id", auth.account_id)
    .order("updated_at", { ascending: false })
    .limit(OWNED_CONVERSATIONS_CAP);
  if (ownedErr) return NextResponse.json({ error: ownedErr.message }, { status: 500 });
  const titles = new Map<string, string | null>();
  for (const c of owned ?? []) titles.set(c.id as string, (c.title as string | null) ?? null);
  if (titles.size === 0) return NextResponse.json({ items: [] });

  /* The heading WORDS, without the bold marks: PostgREST reads `*` as a
     wildcard in a LIKE, so the exact heading is confirmed by the module. */
  const headingFilter = Object.values(SUMMARY_HEADINGS).map((h) => `content.ilike.%${h}%`).join(",");
  const { data: rows, error } = await supabaseServer
    .from("ai_messages")
    .select("id, conversation_id, role, source, content, created_at")
    .in("conversation_id", Array.from(titles.keys()))
    .eq("role", "assistant")
    .eq("source", "voice")
    .or(headingFilter)
    .order("created_at", { ascending: false })
    .limit(CALLS_SCAN_ROWS);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const items = collectCalls((rows ?? []) as CallRow[], titles);
  console.log(`[ai.calls] ok rows=${rows?.length ?? 0} items=${items.length}`);
  return NextResponse.json({ items });
}
