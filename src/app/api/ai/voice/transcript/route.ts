import "server-only";

/* ---------------------------------------------------------------------------
   POST /api/ai/voice/transcript — spoken turns, written into the conversation.

   WHY THIS ROUTE EXISTS. A voice call's audio runs browser-to-vendor directly;
   this server never hears it and never sees a transcript. The only party
   holding the words is the browser, so the browser relays them here, and this
   route — not the browser — decides whether they are written and where.

   WHAT IT CHECKS, IN ORDER.
     1. The voice gate (ai/voice/gate.ts): signed in, internal, allowed voice.
        The same chain the handshake uses; a caller who could not open a call
        cannot write one.
     2. A budget. Each post is a database write, and a call posts one per
        settled turn; a loop posts thousands.
     3. The body's shape and size. At most MAX_TURNS turns, each a role from a
        closed set and text under a cap. Anything else is a 400.
     4. THE CONVERSATION IS THE CALLER'S. Same triple predicate every other
        conversation mutation uses — id, tenant, account — so a crafted id
        from tenant A cannot write into tenant B's thread.

   WHAT IT WRITES. One ai_messages row per turn, in the order given, with
   source='voice' for spoken turns and 'text' for the ones the caller typed
   into the call. The assistant's rows are RELAYED, not generated here, and
   the source mark is what says so to anything reading the table later.

   WHAT IT DOES NOT DO. It does not log the content (production must not log
   full prompts or replies), it does not call any model, and it does not make
   a title with one either: a first turn becomes the title, cut short, the way
   the typed lane already handles very short openers.
   --------------------------------------------------------------------------- */

import { NextResponse } from "next/server";
import { authorizeVoice } from "@/lib/server/ai/voice/gate";
import { BUDGETS, consumeBudget, limitMode, subjectFor } from "@/lib/server/ai/security/rate-limit";
import { supabaseServer } from "@/lib/server/supabase-server";
import { withPublicProvider } from "@/lib/server/ai/observability/public-provider";
import { parseConversationParam } from "@/lib/server/ai/voice/history";

export const dynamic = "force-dynamic";

/* One POST carries a burst of settled turns — after a reconnect, or at
   hang-up — never a whole call. The client batches to the same number. */
const MAX_TURNS = 20;
/* A spoken turn is a few sentences. A typed one is capped by the client at
   2 000 characters; this is the server's own ceiling on either. */
const MAX_TURN_CHARS = 4_000;
const TITLE_CHARS = 60;

type Turn = { role: "user" | "assistant"; text: string; via: "voice" | "text" };

/** The body, or null when it is not what a call would send. Never throws. */
function parseTurns(raw: unknown): Turn[] | null {
  if (!raw || typeof raw !== "object") return null;
  const list = (raw as { turns?: unknown }).turns;
  if (!Array.isArray(list) || list.length === 0 || list.length > MAX_TURNS) return null;
  const out: Turn[] = [];
  for (const item of list) {
    if (!item || typeof item !== "object") return null;
    const { role, text, via } = item as { role?: unknown; text?: unknown; via?: unknown };
    if (role !== "user" && role !== "assistant") return null;
    if (typeof text !== "string") return null;
    const trimmed = text.trim();
    if (!trimmed || trimmed.length > MAX_TURN_CHARS) return null;
    /* Absent means spoken — the common case and the older client's shape. */
    if (via !== undefined && via !== "voice" && via !== "text") return null;
    out.push({ role, text: trimmed, via: via === "text" ? "text" : "voice" });
  }
  return out;
}

export async function POST(req: Request) {
  const gate = await authorizeVoice(req);
  if (gate instanceof NextResponse) return gate;

  if (limitMode() !== "off") {
    const hit = await consumeBudget(subjectFor.account(gate.accountId), BUDGETS.voiceTranscriptPerAccount());
    if (!hit.allowed) {
      console.warn(`[ai.voice.transcript] ratelimit account count=${hit.count} max=${hit.max} mode=${limitMode()}`);
      if (limitMode() === "enforce") {
        return NextResponse.json(
          { error: "Too many transcript writes just now." },
          { status: 429, headers: { "Retry-After": String(hit.retryAfterSec) } },
        );
      }
    }
  }

  const body: unknown = await req.json().catch(() => null);
  const conversationId = parseConversationParam(
    body && typeof body === "object" ? String((body as { conversation_id?: unknown }).conversation_id ?? "") : null,
  );
  const turns = parseTurns(body);
  if (!conversationId || !turns) {
    return NextResponse.json({ error: "conversation_id and turns are required." }, { status: 400 });
  }

  const { data: conv } = await supabaseServer
    .from("ai_conversations")
    .select("id, title, message_count")
    .eq("id", conversationId)
    .eq("tenant_id", gate.tenantId)
    .eq("account_id", gate.accountId)
    .maybeSingle();
  if (!conv) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { data: rows, error } = await supabaseServer
    .from("ai_messages")
    .insert(
      turns.map((t) => ({
        tenant_id: gate.tenantId,
        conversation_id: conversationId,
        role: t.role,
        content: t.text,
        source: t.via,
      })),
    )
    .select("*");
  if (error) {
    /* The message, not the content: Postgres errors name columns and
       constraints, never row values, and the turns must not reach the log. */
    console.error(`[ai.voice.transcript] insert failed: ${error.message}`);
    return NextResponse.json({ error: "Could not save the transcript." }, { status: 500 });
  }

  /* The thread's summary, rolled the way the typed lane rolls it. The title
     is taken from the first USER turn of a still-untitled chat and cut short
     — no model call for a label, on a route that must stay cheap. */
  const firstUser = turns.find((t) => t.role === "user");
  const untitled = (conv.title === "New chat" || !conv.title) && (conv.message_count ?? 0) === 0;
  const title = untitled && firstUser ? firstUser.text.slice(0, TITLE_CHARS) : conv.title;
  const lastTurn = turns[turns.length - 1];
  await supabaseServer
    .from("ai_conversations")
    .update({
      title,
      last_preview: lastTurn.text.slice(0, 180),
      message_count: (conv.message_count ?? 0) + turns.length,
    })
    .eq("id", conversationId)
    .eq("tenant_id", gate.tenantId)
    .eq("account_id", gate.accountId);

  return NextResponse.json({
    /* Rows carry ai_messages.provider (null here) — masked on the way out
       like every other message the client receives, so this route can never
       become the one that forgets. */
    messages: (rows ?? []).map((r) => withPublicProvider(r)),
    conversation: { id: conversationId, title },
  });
}
