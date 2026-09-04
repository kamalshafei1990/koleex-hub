import "server-only";

/* ---------------------------------------------------------------------------
   GET /api/ai/conversations/search?q=… — which of MY chats said this.

   Roadmap C2. The sidebar's box matched titles it already had; this matches
   message bodies on the server and returns one hit per conversation with a
   snippet. The client merges the ids into the list it shows.

   THE SAME DOORS AS EVERY CONVERSATION READ: session, internal user, then
   the caller's own tenant + account. The scope is enforced by construction
   — messages are matched only inside the id list that pair returns — so
   there is no query that reaches another account's words. A budget keeps a
   fast typist from turning a search box into a scan loop. Logs carry counts
   only: what was searched for is the caller's.
   --------------------------------------------------------------------------- */

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth } from "@/lib/server/auth";
import { requireInternalUser } from "@/lib/server/ai/require-internal";
import { BUDGETS, consumeBudget, limitMode, subjectFor } from "@/lib/server/ai/security/rate-limit";
import {
  SEARCH_SCAN_ROWS,
  collectHits,
  likePattern,
  normalizeQuery,
  type SearchRow,
} from "@/lib/server/ai/conversation-search";

export const dynamic = "force-dynamic";

/** An owner with more conversations than this searches the newest of them.
 *  Far above any real account today; a bound so the id list stays a list. */
const OWNED_CONVERSATIONS_CAP = 500;

export async function GET(req: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  {
    const notInternal = requireInternalUser(auth);
    if (notInternal) return notInternal;
  }

  const query = normalizeQuery(new URL(req.url).searchParams.get("q"));
  /* Nothing worth asking is not an error: the client shows what it has. */
  if (!query) return NextResponse.json({ hits: [] });

  if (limitMode() !== "off") {
    const hit = await consumeBudget(subjectFor.account(auth.account_id), BUDGETS.conversationSearchPerAccount());
    if (!hit.allowed) {
      console.warn(`[ai.conversations.search] ratelimit account count=${hit.count} max=${hit.max} mode=${limitMode()}`);
      if (limitMode() === "enforce") {
        return NextResponse.json(
          { error: "Too many searches just now." },
          { status: 429, headers: { "Retry-After": String(hit.retryAfterSec) } },
        );
      }
    }
  }

  /* THE CALLER'S CONVERSATIONS, and only those — the same pair every
     conversation read uses. The message match below runs inside this list. */
  const { data: owned, error: ownedErr } = await supabaseServer
    .from("ai_conversations")
    .select("id")
    .eq("tenant_id", auth.tenant_id)
    .eq("account_id", auth.account_id)
    .order("updated_at", { ascending: false })
    .limit(OWNED_CONVERSATIONS_CAP);
  if (ownedErr) return NextResponse.json({ error: ownedErr.message }, { status: 500 });
  const ids = (owned ?? []).map((c) => c.id as string);
  if (ids.length === 0) return NextResponse.json({ hits: [] });

  const { data: rows, error } = await supabaseServer
    .from("ai_messages")
    .select("conversation_id, content")
    .in("conversation_id", ids)
    .in("role", ["user", "assistant"])
    .ilike("content", likePattern(query))
    .order("created_at", { ascending: false })
    .limit(SEARCH_SCAN_ROWS);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const hits = collectHits((rows ?? []) as SearchRow[], query);
  console.log(`[ai.conversations.search] ok chars=${query.length} rows=${rows?.length ?? 0} hits=${hits.length}`);
  return NextResponse.json({ hits });
}
