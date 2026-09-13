import "server-only";

/* ---------------------------------------------------------------------------
   POST /api/ai/agent/confirm — a TAP in the chat confirms a write tool's
   preview (tasks phase 2, 2026-09-13; plan §4).

   The text lane's writes are two-phase: the tool previews, the ledger
   records the preview, and a second call with confirm:true and the SAME
   arguments runs it. Until now that second call came only from the model
   after the user typed "yes". The Task card's Save button sends it from the
   page instead, exactly as the call screen's tap does through
   /api/ai/voice/tool. THE PAGE IS A COURIER, NOT AN AUTHORITY: everything
   in the body is a claim, and this route re-decides all of it —
     1. the same door as the chat itself (signed in, internal account);
     2. the tool must be on the server's own chat-confirm list (write tools
        with a preview; nothing read-only, nothing outside it);
     3. a per-minute budget;
     4. the conversation must be the caller's own — the preview was recorded
        under it, and the ledger matches on it;
     5. dispatchTool re-checks the caller's permission for that tool, then
        the ledger: a tap whose arguments match no recorded preview for this
        account, tenant, conversation and tool is refused (UNCONFIRMED), so a
        page that invents a tap writes nothing.
   On success the tool's own confirmation line is written to the thread as an
   assistant message, so the transcript — and the model's next turn — know
   the task was saved; the page appends the same row. The reply carries the
   tool's envelope for the card (ok, status, message, data).
   --------------------------------------------------------------------------- */

import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/server/auth";
import { requireInternalUser } from "@/lib/server/ai/require-internal";
import { buildUserContext } from "@/lib/server/ai-agent/permissions";
import { consumeBudget, limitMode, subjectFor } from "@/lib/server/ai/security/rate-limit";
import { dispatchTool } from "@/lib/server/ai-agent/tool-registry";
import { parseConversationParam } from "@/lib/server/ai/voice/history";
import { supabaseServer } from "@/lib/server/supabase-server";
import { withPublicProvider } from "@/lib/server/ai/observability/public-provider";
import { isChatConfirmTool, CHAT_CONFIRM_MAX_ARGS_BYTES } from "@/lib/server/ai/chat-confirm";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

/** Taps a minute per account. A person confirms a handful of tasks an hour;
 *  a page in a loop does not get to write faster than that. */
const CHAT_CONFIRM_PER_MIN = Math.max(1, Number(process.env.AI_LIMIT_CHAT_CONFIRM_PER_MIN) || 40);

export async function POST(req: Request) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const internalOnly = requireInternalUser(auth);
  if (internalOnly) return internalOnly;
  const ctx = await buildUserContext(auth);

  let body: { conversation_id?: unknown; name?: unknown; arguments?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const name = typeof body.name === "string" ? body.name : "";
  const args = body.arguments && typeof body.arguments === "object" && !Array.isArray(body.arguments) ? (body.arguments as Record<string, unknown>) : null;
  if (!name || !args) return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  if (JSON.stringify(args).length > CHAT_CONFIRM_MAX_ARGS_BYTES) return NextResponse.json({ error: "Too large." }, { status: 413 });
  if (!isChatConfirmTool(name)) return NextResponse.json({ error: "Not allowed." }, { status: 403 });

  if (limitMode() !== "off") {
    const budget = await consumeBudget(subjectFor.account(auth.account_id), { bucket: "chat_confirm", windowSec: 60, max: CHAT_CONFIRM_PER_MIN });
    if (!budget.allowed && limitMode() === "enforce") {
      return NextResponse.json({ error: "Too many confirmations. Please wait a moment." }, { status: 429, headers: { "Retry-After": String(budget.retryAfterSec ?? 30) } });
    }
  }

  /* THE CONVERSATION IS THE CALLER'S OWN. The preview was recorded under
     it (the text lane always passes the id); the ledger matches on it. */
  const conversationId = parseConversationParam(typeof body.conversation_id === "string" ? body.conversation_id : null);
  if (!conversationId) return NextResponse.json({ error: "conversation_id required" }, { status: 400 });
  const { data: conv } = await supabaseServer
    .from("ai_conversations")
    .select("id, message_count")
    .eq("id", conversationId)
    .eq("tenant_id", auth.tenant_id)
    .eq("account_id", auth.account_id)
    .maybeSingle();
  if (!conv) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const t0 = Date.now();
  const result = await dispatchTool(ctx, name, { ...args, confirm: true }, { conversationId });
  console.log(`[ai.chat.confirm] ${name} ok=${result.ok} status=${result.permissionStatus} ms=${Date.now() - t0}`);

  /* THE THREAD LEARNS WHAT HAPPENED. The tool's own line becomes an
     assistant message, so a reload shows the task was saved and the model's
     next turn reads it as done rather than still waiting. Best effort: a
     failed insert does not undo the write, and the card still says saved. */
  let message: Record<string, unknown> | null = null;
  if (result.ok && result.permissionStatus === "allowed" && typeof result.message === "string" && result.message.trim()) {
    const [ins] = await Promise.all([
      supabaseServer
        .from("ai_messages")
        .insert({ tenant_id: auth.tenant_id, conversation_id: conversationId, role: "assistant", content: result.message, provider: "tool:confirm" })
        .select("*")
        .single(),
      supabaseServer
        .from("ai_conversations")
        .update({ last_preview: result.message.slice(0, 180), message_count: (conv.message_count ?? 0) + 1 })
        .eq("id", conversationId)
        .eq("tenant_id", auth.tenant_id)
        .eq("account_id", auth.account_id),
    ]);
    if (ins.error) console.error("[ai.chat.confirm.message]", ins.error.message);
    else message = withPublicProvider(ins.data as Record<string, unknown>);
  }

  return NextResponse.json(
    {
      output: { ok: result.ok, status: result.permissionStatus, message: result.message ?? null, data: result.data ?? null },
      ...(message ? { message } : {}),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
