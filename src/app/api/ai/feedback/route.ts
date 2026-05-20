import "server-only";

/* ===========================================================================
   POST /api/ai/feedback — per-message thumbs-up / thumbs-down.

   Operators rate individual assistant replies inside the chat. We log
   the signal server-side so the agent team can spot bad responses
   quickly. Today the endpoint is a thin telemetry shim:

     1. Authenticate the caller (rate-limits + tenant scope come for
        free from requireAuth).
     2. Validate payload — message_id + value ∈ {"up","down"}.
     3. Console.info for now (Vercel log retention captures it).

   When the dedicated ai_message_feedback table lands, swap the
   console.info for an INSERT keyed by tenant + account. The client
   contract stays unchanged.
   ========================================================================== */

import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/server/auth";

type Payload = { message_id?: unknown; value?: unknown };

function asString(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

export async function POST(req: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  let body: Payload;
  try { body = (await req.json()) as Payload; }
  catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const messageId = asString(body.message_id);
  const value = asString(body.value);
  if (!messageId) return NextResponse.json({ error: "Missing message_id" }, { status: 400 });
  if (value !== "up" && value !== "down") {
    return NextResponse.json({ error: "value must be 'up' or 'down'" }, { status: 400 });
  }

  console.info("[ai/feedback]", {
    tenant: auth.tenant_id,
    account: auth.account_id,
    message_id: messageId,
    value,
    at: new Date().toISOString(),
  });

  return NextResponse.json({ ok: true });
}
