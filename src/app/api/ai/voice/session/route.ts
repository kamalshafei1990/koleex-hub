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
import {
  buildVoiceSessionPayload,
  publicVoiceList,
  TAUGHT_INDEX_BUDGET_BYTES,
} from "@/lib/server/ai/voice/session-config";
import { taughtQuestionIndex } from "@/lib/server/ai-knowledge";
import { describeFetchFailure } from "@/lib/server/ai/voice/fetch-cause";

/* ---------------------------------------------------------------------------
   THIS FUNCTION RUNS IN A DIFFERENT REGION FROM THE REST OF THE APP, and the
   reason is in vercel.json rather than here — so it is written down here too,
   because a lone region override is otherwise indistinguishable from a
   mistake.

   Production said, on both attempts and repeatedly:

     cause=TypeError/UND_ERR_CONNECT_TIMEOUT  afterMs=10389  budgetMs=13000

   UND_ERR_CONNECT_TIMEOUT is the TCP connection never opening. Not DNS —
   that is ENOTFOUND. Not a refusal — that is ECONNREFUSED. Not TLS, not a
   reset. The packets left and nothing came back, in ~10.4s, every time,
   from Tokyo to the vendor's Beijing endpoint.

   Nothing this route can do fixes an unroutable path, so the route moved
   instead: Hong Kong, which peers into mainland China in a way Tokyo does
   not. ONLY THIS FUNCTION MOVES. Everything else stays in hnd1.

   AND IT DOES NOT WEAKEN THE CHINA REQUIREMENT — this is the part worth
   being explicit about, because it looks at first glance as though it
   might. The AUDIO never touches this server: it is browser ↔ vendor
   directly, and for a caller inside mainland China that path is
   China-to-China and unchanged. The only leg that moves is the SDP exchange
   our server brokers on their behalf, which was the one leg that was
   broken.

   THE COST, stated: this function's own auth and knowledge reads now cross
   Hong Kong → wherever the database lives, instead of Tokyo → there. That is
   tens of milliseconds in front of a call that otherwise spends ten seconds
   failing. */
export const dynamic = "force-dynamic";
/* The handshake is one round trip to the vendor. It is not the call. */
/* Forty-five, because the handshake now gets two attempts. See ATTEMPTS
   below: two 13s attempts plus the auth and permission work in front of them
   has to fit, with room left over for the platform's own overhead. */
export const maxDuration = 45;

/* An SDP offer is a few kilobytes. The cap is not about correctness — it is
   that this route spends OUR key on the caller's behalf, so the caller must
   not be able to make us forward an arbitrarily large body. */
const MAX_SDP_BYTES = 64 * 1024;

/* The taught-question index is a nicety on top of a call that already works.
   It gets a ceiling measured against that: long enough that a cold cache is
   not thrown away, short enough that nobody waits on it. */
const TAUGHT_INDEX_TIMEOUT_MS = 1_500;

/* The reason a fetch failed, in a form that is safe to log. Extracted so the
   hostname-suppression can be RUN rather than eyeballed — see fetch-cause.ts
   for what a bare `TypeError` was costing this investigation. */

/* A handshake that has not answered in this long is not going to. Short,
   because the user is staring at a "connecting…" state, and unlike a turn
   there is no partial result worth waiting for. */
/* ---------------------------------------------------------------------------
   TWO ATTEMPTS, NOT ONE, AND WHY THE SHAPE CHANGED.

   The production logs, not a theory: every failure read

     [ai.voice] handshake timed out region=cn-north

   repeatedly, while our own auth work in the same request finished in 121ms.
   The vendor was not refusing us and the key was not the problem — nothing
   came back at all. This function runs in Tokyo and the voice endpoint is in
   Beijing, so the handshake crosses a network boundary that drops and
   recovers rather than one that is uniformly slow.

   A SINGLE LONG WAIT IS THE WRONG SHAPE FOR THAT. If the path is merely slow,
   one long attempt wins. If it drops and recovers — which is what an
   intermittent "works, then does not, then does" looks like — a second
   attempt beats a longer first one, because the second one gets a fresh
   connection rather than continuing to wait on a dead one.

   So: two attempts at 13s rather than one at 20s. Total 26s inside a 45s
   ceiling, leaving room for the auth and permission work in front and the
   platform's overhead around it.

   NOT MORE THAN TWO. The caller is staring at "Connecting…", and a third
   attempt buys less than it costs in the time a person will wait. If two
   fresh connections both get nothing, the service is not reachable from here
   and saying so is the honest answer.
   --------------------------------------------------------------------------- */
/* ---------------------------------------------------------------------------
   THE BUDGETS, AND WHY THEY ARE NOT ALL THE SAME.

   The logs settled what this failure actually is, and it is not what the two
   previous changes assumed. Over ten hours production shows the handshake
   both succeeding and failing repeatedly — and this pair, 32 seconds apart,
   from the SAME region, is the whole story:

     00:50:02  POST 504  UND_ERR_CONNECT_TIMEOUT
     00:50:34  POST 200

   So the endpoint is not unreachable. The path to it works perhaps half the
   time, in bursts, and a retry a little later lands on a good one.

   WHY TWO EQUAL ATTEMPTS DID NOT HELP. Both used the full budget, and both
   died at undici's own ~10.4s connect timeout — so "two attempts" was really
   two samples taken 21 seconds apart at the cost of the caller's whole wait.
   Against a path that comes and goes, what matters is HOW MANY TIMES you
   sample it, not how long you stare at it once.

   SO: ONE LONG ATTEMPT, THEN SEVERAL SHORT ONES. The first keeps the full
   budget, which means a healthy-but-slow handshake succeeds exactly as it
   does today and this change can never be slower than what it replaces. Only
   once that has failed — which is itself evidence the path is bad right now —
   do the short samples start, and they buy three more chances inside the same
   total wait instead of one.

   THE SHORT BUDGET IS A GUESS UNTIL THE NEXT LOG, and that is deliberate: a
   successful handshake's duration was never recorded, so there is no data yet
   for what "long enough" is. That is fixed below — success is now logged with
   its own timing — and these numbers should be re-tuned from it rather than
   from reasoning. */
const HANDSHAKE_ATTEMPT_BUDGETS_MS = [13_000, 3_000, 3_000, 3_000] as const;
const HANDSHAKE_ATTEMPTS = HANDSHAKE_ATTEMPT_BUDGETS_MS.length;

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
async function authorize(req: Request): Promise<NextResponse | { accountId: string; tenantId: string | null }> {
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

  /* THE TENANT TRAVELS WITH THE ACCOUNT, and it is not an afterthought: every
     knowledge read this route makes is scoped by it, and a null passed where a
     tenant belongs is one tenant's taught knowledge read into another's call. */
  return { accountId: auth.account_id, tenantId: auth.tenant_id ?? null };
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

  let res: Response | null = null;
  let lastCause = "unknown";
  for (let attempt = 1; attempt <= HANDSHAKE_ATTEMPTS; attempt++) {
    /* Set immediately before each fetch, so the elapsed time in the log
       measures that round trip and not the work that preceded it. */
    const startedAt = Date.now();
    const budgetMs = HANDSHAKE_ATTEMPT_BUDGETS_MS[attempt - 1];
    try {
      res = await fetch(cfg.sdpUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/sdp",
          Authorization: `Bearer ${cfg.apiKey}`,
        },
        body: offer,
        /* A FRESH SIGNAL PER ATTEMPT. Reusing one AbortSignal.timeout across
           the loop would abort the second attempt the instant it started,
           because the signal fires on wall-clock time from when it was made —
           the retry would look like an instant failure and prove nothing. */
        signal: AbortSignal.timeout(budgetMs),
      });
      /* SUCCESS IS EVIDENCE TOO, and its absence is why the budgets above are
         still partly a guess. Only failures were ever logged, so nothing
         recorded how long a WORKING handshake takes — which is exactly the
         number needed to decide how long a short attempt should wait before
         giving up on a bad window. Logged at info: it is one line per call
         and it carries no vendor detail. */
      console.log(
        `[ai.voice] handshake ok attempt=${attempt}/${HANDSHAKE_ATTEMPTS} ` +
          `from=${process.env.VERCEL_REGION ?? "local"} region=${cfg.regionLabel} ` +
          `afterMs=${Date.now() - startedAt} budgetMs=${budgetMs}`,
      );
      break;
    } catch (e) {
      const timedOut = e instanceof Error && (e.name === "TimeoutError" || e.name === "AbortError");
      lastCause = describeFetchFailure(e);
      /* THE ELAPSED TIME IS THE DIAGNOSIS. "Timed out" and "could not
         connect" both land here and need opposite investigations: a handshake
         that dies in 40ms is DNS, egress or a refused connection, and one
         that runs the full budget is a service that is up and slow. The
         attempt number matters too — a first attempt that times out and a
         second that succeeds is a dropping path, not a slow one.

         AND THE THIRD CASE THIS COMMENT DID NOT ANTICIPATE, which is the one
         production is actually in: neither. Both attempts died at ~10.4s
         against a 13s budget, with cause=TypeError. Dying BELOW your own
         budget is not a timeout you set — it is something underneath giving
         up first, and `fetch` reports every one of those the same way: a bare
         `TypeError`, whose real reason is in `.cause`. Reading only `e.name`
         turned "DNS does not resolve", "connection refused", "TLS rejected"
         and "the TCP connection never opened" into one indistinguishable
         word, and sent this investigation to the wrong place twice. */
      /* `region` is the VENDOR's label and always was. `from` is where OUR
         function actually ran, and without it the region move this failure
         prompted could not be confirmed: a handshake still failing would be
         indistinguishable from a handshake that never moved. Vercel sets
         VERCEL_REGION; anywhere else it is simply absent. */
      console.error(
        `[ai.voice] handshake ${timedOut ? "timed out" : "failed"} ` +
          `attempt=${attempt}/${HANDSHAKE_ATTEMPTS} from=${process.env.VERCEL_REGION ?? "local"} ` +
          `region=${cfg.regionLabel} ` +
          `afterMs=${Date.now() - startedAt} budgetMs=${budgetMs} cause=${lastCause}`,
      );
    }
  }

  /* Both attempts got nothing. The service is not reachable from here, and
     the client turns this status into "the voice service is not responding" —
     which is now a statement the logs above can back up. */
  if (!res) {
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
  /* WHAT THE OWNER HAS TAUGHT, as a list of questions the model can recognise
     across languages. See TAUGHT_INDEX_BUDGET_BYTES for why the questions
     travel and the answers do not.

     AFTER THE VENDOR HAS ALREADY ANSWERED, deliberately. This is a database
     read on the one path in this product with a history of timing out, and
     putting it in front of the handshake would spend part of that budget
     before the attempt that actually matters. Here it costs the caller a few
     milliseconds of a round trip that has already succeeded.

     AND IT CANNOT TAKE THE CALL DOWN. A call with no taught index is a call
     that finds taught answers by search alone — the product before this
     change, which worked. A call that fails because a knowledge query was slow
     is a regression. So: a hard ceiling, and any failure means an empty list
     rather than an error. */
  let taughtQuestions: string[] = [];
  try {
    taughtQuestions = await Promise.race([
      taughtQuestionIndex(gate.tenantId, TAUGHT_INDEX_BUDGET_BYTES),
      new Promise<string[]>((resolve) => setTimeout(() => resolve([]), TAUGHT_INDEX_TIMEOUT_MS)),
    ]);
  } catch {
    /* Logged, not raised: the call is fine without it and the caller is
       waiting. A silent empty list would hide a knowledge plane that has
       stopped answering, which is worth knowing about. */
    console.error("[ai.voice] taught index unavailable — continuing without it");
  }

  const payload = buildVoiceSessionPayload(voice, taughtQuestions);
  return NextResponse.json(
    { sdp: answer, session: payload.full, session_compact: payload.compact },
    { status: 200, headers: { "Cache-Control": "no-store" } },
  );
}
