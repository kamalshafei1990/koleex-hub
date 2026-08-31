import "server-only";

/* ---------------------------------------------------------------------------
   POST /api/ai/voice/tool — run ONE read-only tool on behalf of a voice call.

   WHY THIS ROUTE EXISTS. A voice call is browser ↔ vendor directly: the audio
   never touches our servers, which is what makes it fast and what makes it
   work from mainland China. But that also means the model's tool calls arrive
   in the BROWSER, and the browser must not run them — the tools read Koleex
   data behind a permission layer, and the standing rule is that the client
   never determines a permission, the server does. So the browser relays the
   request here, and this is where it becomes real.

   THE BROWSER IS A COURIER, NOT AN AUTHORITY. Everything in the request body
   originates with the model and passes through the page: both are outside the
   trust boundary. The tool name is a CLAIM. This route re-decides all of it:

     1. Same door as the call itself — signed in, internal account type,
        "AI Voice" view permission. A caller who may not hold a call may not
        run its tools either.
     2. The name must be on the server's own voice allow-list. Read-only, and
        short, because a voice call has no confirmation step — see
        ai/voice/tools.ts for what that excludes and why.
     3. dispatchTool re-checks the caller's permissions for that specific
        tool, filters the fields they may not see, and writes the audit row.
        Defence in depth: a tool on the allow-list is still refused here for a
        user who may not run it.
     4. A per-minute budget, because a model that can call a tool and then be
        asked to speak again can do that in a loop.

   WHAT THIS ROUTE NEVER DOES: run a write. Not because writes are hard, but
   because a spoken "yes" is not a confirmation a server can verify — it is
   audio the model transcribed, arriving on the same channel as the request.
   --------------------------------------------------------------------------- */

import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/server/auth";
import { requireInternalUser } from "@/lib/server/ai/require-internal";
import { buildUserContext, checkModule } from "@/lib/server/ai-agent/permissions";
import { consumeBudget, limitMode, subjectFor } from "@/lib/server/ai/security/rate-limit";
import { dispatchTool } from "@/lib/server/ai-agent/tool-registry";
import { isVoiceTool } from "@/lib/server/ai/voice/tools";

export const dynamic = "force-dynamic";
/* A lookup, not a conversation. The caller is mid-sentence waiting for it. */
export const maxDuration = 30;

/* Arguments the model produced. A few hundred bytes in practice; the cap is
   about not letting a page make us parse something enormous. */
const MAX_ARGS_BYTES = 8 * 1024;

/* Generous for a person talking, tight enough that a loop cannot run away.
   Complements the per-session cap the client enforces: this one survives a
   page that has been tampered with, which is the only reason it is here too. */
const VOICE_TOOL_CALLS_PER_MIN = Number(process.env.AI_LIMIT_VOICE_TOOLS_PER_MIN) || 20;

export async function POST(req: Request) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  const internal = requireInternalUser(auth);
  if (internal) return internal;

  const ctx = await buildUserContext(auth);
  const decision = checkModule(ctx, "AI Voice", "view");
  if (!decision.allowed) {
    return NextResponse.json(
      { error: decision.reason ?? "You don't have access to voice." },
      { status: 403 },
    );
  }

  let body: { name?: unknown; arguments?: unknown; call_id?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const name = typeof body.name === "string" ? body.name : "";
  const callId = typeof body.call_id === "string" ? body.call_id : "";
  const argsRaw = typeof body.arguments === "string" ? body.arguments : "";

  if (!name || !callId) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  if (Buffer.byteLength(argsRaw) > MAX_ARGS_BYTES) {
    return NextResponse.json({ error: "Arguments too large." }, { status: 413 });
  }

  /* THE ALLOW-LIST, BEFORE ANYTHING ELSE IS DONE WITH THE NAME. A name that
     is not on it is refused outright — never dispatched, never looked up in
     the registry. A model can name a tool it was not offered, and a page can
     send whatever it likes; neither gets to widen what voice may do.

     The refusal deliberately does not say which tools exist. */
  if (!isVoiceTool(name)) {
    console.warn(`[ai.voice.tool] refused off-list name account=${auth.account_id}`);
    return NextResponse.json(
      { error: "That is not something I can do from a call." },
      { status: 403 },
    );
  }

  const hit = await consumeBudget(subjectFor.account(auth.account_id), {
    bucket: "voice_tool",
    windowSec: 60,
    max: VOICE_TOOL_CALLS_PER_MIN,
  });
  if (!hit.allowed) {
    console.warn(`[ai.voice.tool] ratelimit count=${hit.count} max=${hit.max} mode=${limitMode()}`);
    if (limitMode() === "enforce") {
      return NextResponse.json(
        { error: "Too many lookups just now. Give it a moment." },
        { status: 429, headers: { "Retry-After": String(hit.retryAfterSec) } },
      );
    }
  }

  /* The model's arguments. Malformed JSON is the model's mistake, not the
     user's, and it is reported to the model rather than to a screen: it can
     try again with a well-formed call, which is the useful outcome. */
  let args: Record<string, unknown> = {};
  if (argsRaw) {
    try {
      const parsed: unknown = JSON.parse(argsRaw);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        args = parsed as Record<string, unknown>;
      }
    } catch {
      return NextResponse.json(
        { call_id: callId, output: { ok: false, message: "Those arguments were not valid JSON." } },
        { status: 200 },
      );
    }
  }

  const result = await dispatchTool(ctx, name, args);

  /* WHAT GOES BACK TO THE MODEL. The tool's own envelope, unchanged — it is
     already the shape every other lane hands the model, already
     permission-filtered by dispatchTool, and already carries its own honest
     failure text. Nothing is added here, and the vendor's or provider's
     internals are not in it.

     Status 200 even when the tool refused: the REQUEST succeeded, and the
     refusal is a result the model must hear and say out loud. An HTTP error
     here would leave the call waiting for an answer that never comes. */
  return NextResponse.json(
    {
      call_id: callId,
      output: {
        ok: result.ok,
        status: result.permissionStatus,
        message: result.message,
        data: result.data,
      },
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
