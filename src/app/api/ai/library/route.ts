import "server-only";

/* ---------------------------------------------------------------------------
   GET /api/ai/library — every picture in MY chats, newest first.

   Roadmap C3. The same doors as every conversation read: session, internal
   user, then the caller's own tenant + account. Messages are read inside
   the caller's own conversation ids, so there is no request that reaches
   another account's pictures. The index is the saved markdown itself — see
   ai/library.ts — so nothing new is stored. Logs carry counts only.
   --------------------------------------------------------------------------- */

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth } from "@/lib/server/auth";
import { requireInternalUser } from "@/lib/server/ai/require-internal";
import { BUDGETS, consumeBudget, limitMode, subjectFor } from "@/lib/server/ai/security/rate-limit";
import { LIBRARY_SCAN_ROWS, collectLibrary, type LibraryRow } from "@/lib/server/ai/library";

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
      console.warn(`[ai.library] ratelimit account count=${hit.count} max=${hit.max} mode=${limitMode()}`);
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

  /* Only messages that carry a markdown image at all — the cheap filter the
     database can apply before a row travels. */
  const { data: rows, error } = await supabaseServer
    .from("ai_messages")
    .select("id, conversation_id, content, created_at")
    .in("conversation_id", Array.from(titles.keys()))
    .like("content", "%![%](https://%")
    .order("created_at", { ascending: false })
    .limit(LIBRARY_SCAN_ROWS);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const items = collectLibrary((rows ?? []) as LibraryRow[], titles);
  console.log(`[ai.library] ok rows=${rows?.length ?? 0} items=${items.length}`);
  return NextResponse.json({ items });
}
