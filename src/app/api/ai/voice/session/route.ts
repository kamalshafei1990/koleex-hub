import "server-only";

/* ---------------------------------------------------------------------------
   POST /api/ai/voice/session — open a realtime voice call.

   Phase 15, step 1 of PHASE_15_VOICE_DESIGN §7. No UI, no client, nothing
   else in the product reaches this yet.

   WHAT IT IS. The browser generates a WebRTC offer and sends it here. This
   route authenticates the user, decides whether they may talk at all, picks
   the region, adds the API key, forwards the offer to the vendor, and returns
   the answer. After that the audio path is browser-to-vendor DIRECTLY and this
   route is not involved again for the length of the call.

   WHY THIS EXISTS RATHER THAN A RELAY. v2 of the design concluded voice needed
   a second service to hold a WebSocket, because the WebSocket handshake
   carries the real API key. That was true of the model then chosen and of no
   other transport. The WebRTC handshake is ONE HTTP POST — an offer in, an
   answer out — which is exactly the shape a Function is for. The key lives and
   dies inside this function invocation.

   THE THREE THINGS THIS MUST NEVER DO, each of which has a test:

     1. Return the key, any prefix of it, its length, or the endpoint it was
        sent to. The client needs the answer SDP and nothing else.
     2. Take the endpoint, region or model FROM THE CLIENT. The standing rule
        is *"the client application must never determine this permission; the
        server determines it"*, and a client that could name its own endpoint
        could route our key somewhere we did not choose.
     3. Echo the vendor's error body. It can name hosts, workspaces and quota
        state. Logged for us, generic for the caller.

   WHAT IS NOT PROVEN HERE. This environment's egress policy refuses to reach
   the vendor, so the SDP exchange itself cannot be exercised. That is why the
   config parsing lives in ai/voice/config.ts, which the suite runs directly:
   everything except the one fetch is testable, and the one fetch is kept as
   small and as dumb as it can be.
   --------------------------------------------------------------------------- */

import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/server/auth";
import { requireInternalUser } from "@/lib/server/ai/require-internal";
import { buildUserContext, checkModule } from "@/lib/server/ai-agent/permissions";
import { consumeBudget, limitMode, subjectFor } from "@/lib/server/ai/security/rate-limit";
import { parseVoiceConfig, diagnoseVoiceConfig, resolveVoice, type VoiceEnv } from "@/lib/server/ai/voice/config";
import { buildVoiceSessionPayload, publicVoiceList } from "@/lib/server/ai/voice/session-config";

export const dynamic = "force-dynamic";
/* The handshake is one round trip to the vendor. It is not the call. */
export const maxDuration = 30;

/* An SDP offer is a few kilobytes. The cap is not about correctness — it is
   that this route spends OUR key on the caller's behalf, so the caller must
   not be able to make us forward an arbitrarily large body. */
const MAX_SDP_BYTES = 64 * 1024;

/* A handshake that has not answered in this long is not going to. Short,
   because the user is staring at a "connecting…" state, and unlike a turn
   there is no partial result worth waiting for. */
const HANDSHAKE_TIMEOUT_MS = 10_000;

/* A voice call is the only feature in this product that spends money
   continuously while the user says nothing, so the budget is on SESSIONS
   rather than turns and is deliberately tight. A person opens a handful of
   calls a minute at the very most; a loop opens hundreds. */
const VOICE_SESSIONS_PER_MIN = Number(process.env.AI_LIMIT_VOICE_SESSIONS_PER_MIN) || 6;

/* Named explicitly rather than passing `process.env`. The config module takes
   the four variables it is allowed to see and nothing else, so a future
   variable added to the environment cannot silently become an input to it. */
function voiceEnv(): VoiceEnv {
  return {
    AI_VOICE_BASE_URL: process.env.AI_VOICE_BASE_URL,
    AI_VOICE_API_KEY: process.env.AI_VOICE_API_KEY,
    AI_VOICE_MODEL: process.env.AI_VOICE_MODEL,
    AI_VOICE_REGION_LABEL: process.env.AI_VOICE_REGION_LABEL,
    /* Omitted when the catalogue was added, so a configured AI_VOICE_VOICES
       was read by nothing and the picker could never appear. */
    AI_VOICE_VOICES: process.env.AI_VOICE_VOICES,
  };
}

/* THE SAME GATE FOR BOTH VERBS, in one place. A second handler with its own
   copy of this chain is a second place for a step to be dropped, and the step
   most easily dropped is requireInternalUser — which was already omitted once
   from this very route. Not exported: a Next.js route file may only export
   route handlers. */
async function authorize(req: Request): Promise<NextResponse | { accountId: string }> {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  /* THE DOOR, BEFORE ANY PERMISSION REASONING. Owner directive 2026-08-03:
     Koleex AI must not be REACHABLE by a non-internal account type at all,
     because customer-portal logins share the accounts table and "the tools
     would deny anyway" is not acceptable exposure. This route omitted it in
     its first draft and validate:ai-api-v1 named it — a customer-portal
     account holding an "AI Voice" permission row could have opened a call. */
  const internal = requireInternalUser(auth);
  if (internal) return internal;

  /* DENY BY DEFAULT, and that is the point. checkModule has no open-access
     fallback: a user with no row for this module is refused. For a new,
     costly, security-sensitive capability that is the correct default — a
     super-admin can use it immediately, everyone else when an admin decides. */
  const ctx = await buildUserContext(auth);
  const decision = checkModule(ctx, "AI Voice", "view");
  if (!decision.allowed) {
    return NextResponse.json(
      { error: decision.reason ?? "You don't have access to voice." },
      { status: 403 },
    );
  }

  return { accountId: auth.account_id };
}

/* GET — which voices this deployment offers.

   KEYS AND LABELS ONLY. The vendor's own voice ids are never listed to a
   client: a browser that cannot name a voice cannot ask for one that was not
   offered, and the id is vendor identity besides. Behind the same gate as the
   handshake, because which capabilities exist is not public either. */
export async function GET(req: Request) {
  const gate = await authorize(req);
  if (gate instanceof NextResponse) return gate;

  const cfg = parseVoiceConfig(voiceEnv());
  /* Not configured is not an error here: no voice service means no voices to
     choose between, and a picker that cannot be used should not be drawn. */
  return NextResponse.json(
    { voices: cfg ? publicVoiceList(cfg.voices) : [] },
    { headers: { "Cache-Control": "no-store" } },
  );
}

export async function POST(req: Request) {
  const gate = await authorize(req);
  if (gate instanceof NextResponse) return gate;
  const auth = { account_id: gate.accountId };

  /* After auth so the counter is keyed to a real account, before any vendor
     work so a blocked request costs nothing. Fails OPEN, like every other
     budget here: a limiter must not become an outage. */
  if (limitMode() !== "off") {
    const hit = await consumeBudget(subjectFor.account(auth.account_id), {
      bucket: "voice_session",
      windowSec: 60,
      max: VOICE_SESSIONS_PER_MIN,
    });
    if (!hit.allowed) {
      console.warn(`[ai.voice] ratelimit account count=${hit.count} max=${hit.max} mode=${limitMode()}`);
      if (limitMode() === "enforce") {
        return NextResponse.json(
          { error: "Too many voice calls started just now. Give it a moment." },
          { status: 429, headers: { "Retry-After": String(hit.retryAfterSec) } },
        );
      }
    }
  }

  const cfg = parseVoiceConfig(voiceEnv());
  if (!cfg) {
    /* The REASON goes to the log, not to the caller. diagnoseVoiceConfig names
       variables rather than values, but an ordinary user has no business
       learning which of our environment variables is unset. */
    console.error(`[ai.voice] not configured: ${diagnoseVoiceConfig(voiceEnv()).join(" · ")}`);
    return NextResponse.json({ error: "Voice is not available right now." }, { status: 503 });
  }

  /* Read as TEXT. An SDP offer is not JSON, and parsing it would mean
     understanding it — this route does not need to and should not. */
  const offer = await req.text().catch(() => "");
  if (!offer || offer.length > MAX_SDP_BYTES || !offer.startsWith("v=")) {
    /* Every SDP begins `v=0`. Checking the first two characters rejects an
       empty body and an accidental JSON post without pretending to validate a
       protocol this route deliberately does not parse. */
    return NextResponse.json({ error: "A valid SDP offer is required." }, { status: 400 });
  }

  let res: Response;
  try {
    res = await fetch(cfg.sdpUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/sdp",
        Authorization: `Bearer ${cfg.apiKey}`,
      },
      body: offer,
      signal: AbortSignal.timeout(HANDSHAKE_TIMEOUT_MS),
    });
  } catch (e) {
    const timedOut = e instanceof Error && (e.name === "TimeoutError" || e.name === "AbortError");
    console.error(`[ai.voice] handshake ${timedOut ? "timed out" : "failed"} region=${cfg.regionLabel}`);
    return NextResponse.json({ error: "Could not start the call. Try again." }, { status: 504 });
  }

  if (!res.ok) {
    /* The vendor's body can name hosts, workspace ids and quota state. It is
       read for the log — truncated — and never forwarded. */
    const detail = (await res.text().catch(() => "")).slice(0, 300);
    console.error(`[ai.voice] handshake rejected status=${res.status} region=${cfg.regionLabel} detail=${detail}`);
    return NextResponse.json({ error: "Could not start the call. Try again." }, { status: 502 });
  }

  const answer = await res.text().catch(() => "");
  if (!answer.startsWith("v=")) {
    console.error(`[ai.voice] handshake returned a non-SDP body region=${cfg.regionLabel}`);
    return NextResponse.json({ error: "Could not start the call. Try again." }, { status: 502 });
  }

  /* THE SESSION IS AUTHORED HERE AND RELAYED THERE. `session.update` carries
     the voice today and will carry instructions and tool definitions; a
     browser that composes it is a browser that can rewrite them. The client
     receives an object it puts on the DataChannel unchanged.

     An unknown or absent key resolves to null and the vendor's default voice
     is used — the browser proposes, the server disposes, and a request for a
     voice this deployment does not offer is quietly not honoured rather than
     being an error the user has to understand. */
  const requested = new URL(req.url).searchParams.get("voice");
  const voice = resolveVoice(cfg.voices, requested);

  /* Still no model id, no endpoint, no key, no region. What changed is that
     the answer now travels beside a configuration rather than alone. */
  /* BOTH LENGTHS. A DataChannel refuses a message larger than the size it
     negotiated and throws rather than truncating, and only the client can see
     that limit — but shortening a policy is authoring one, so the server
     writes both and the client only chooses between them. */
  const payload = buildVoiceSessionPayload(voice);
  return NextResponse.json(
    { sdp: answer, session: payload.full, session_compact: payload.compact },
    { status: 200, headers: { "Cache-Control": "no-store" } },
  );
}
