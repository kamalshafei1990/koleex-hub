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
import { authorizeVoice } from "@/lib/server/ai/voice/gate";
import { consumeBudget, limitMode, subjectFor } from "@/lib/server/ai/security/rate-limit";
import { supabaseServer } from "@/lib/server/supabase-server";
import { loadRecentTurns, parseConversationParam, type RecentTurn } from "@/lib/server/ai/voice/history";
import {
  parseVoiceConfig,
  diagnoseVoiceConfig,
  resolveVoice,
  readAltVoiceEnv,
  parseRegionHint,
  type VoiceEnv,
  type VoiceConfig,
  type VoiceRegionSlot,
} from "@/lib/server/ai/voice/config";
import {
  buildVoiceSessionPayload,
  publicVoiceList,
  parseSttLanguage,
  TAUGHT_INDEX_BUDGET_BYTES,
} from "@/lib/server/ai/voice/session-config";
import { taughtQuestionIndex } from "@/lib/server/ai-knowledge";
import { describeFetchFailure } from "@/lib/server/ai/voice/fetch-cause";

/* ---------------------------------------------------------------------------
   THIS FUNCTION RUNS WHERE THE REST OF THE APP RUNS, and it briefly did not.

   For a day it was pinned to Hong Kong, on the reasoning that Hong Kong peers
   into mainland China in a way Tokyo does not, and that the endpoint was
   therefore unroutable from Tokyo. The log then showed the move had really
   taken effect (`from=hkg1`) and the handshake still failed — from which I
   concluded that the region was eliminated as a cause.

   THAT CONCLUSION WAS DRAWN FROM ONE FAILURE, and more data reversed it:

     hnd1 (Tokyo)      38 successful handshakes, 23 failures
     hkg1 (Hong Kong)   0 successful handshakes,  9 failures

   Tokyo was working about six times in ten. Hong Kong has never once
   completed a handshake. So the region was not neutral — the move made it
   worse, and "it still fails there" was not evidence that where we run does
   not matter. It was one sample.

   The pin is gone. This function is back in the project's own region, and
   the vercel.json `functions` override with it.

   WHAT THIS DOES NOT EXPLAIN, and is still open with the vendor: why the
   connection is refused at the TCP layer at all — UND_ERR_CONNECT_TIMEOUT,
   no HTTP response of any kind, from either region. Tokyo is the better of
   two bad paths, not a working one. */
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
/* The typed conversation behind the call, same posture: two small indexed
   reads, and a call with no history is the product before this change. */
const HISTORY_TIMEOUT_MS = 1_500;

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
/* WITH A SECOND REGION CONFIGURED, each region gets the long attempt and one
   short one: 13+3 twice is 32s, inside the same 45s ceiling. Two samples of
   a path that is dead right now buy less than one attempt at a different
   path — which is the whole reason the second region exists. */
const TWO_REGION_ATTEMPT_BUDGETS_MS = [13_000, 3_000] as const;

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

/* The second region's four variables, read the same way. See config.ts for
   why a second region exists at all. */
const altVoiceEnv = readAltVoiceEnv;

/* THE GATE LIVES IN ai/voice/gate.ts NOW, shared with the transcript route.
   It used to be a private function here; a second voice route made a second
   copy the likelier outcome, and a copied chain is how requireInternalUser
   was dropped from this very file once. */
const authorize = authorizeVoice;

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

  const primary = parseVoiceConfig(voiceEnv());
  const alt = parseVoiceConfig(altVoiceEnv());
  if (!primary && !alt) {
    /* The REASON goes to the log, not to the caller. diagnoseVoiceConfig names
       variables rather than values, but an ordinary user has no business
       learning which of our environment variables is unset. */
    console.error(`[ai.voice] not configured: ${diagnoseVoiceConfig(voiceEnv()).join(" · ")}`);
    return NextResponse.json({ error: "Voice is not available right now." }, { status: 503 });
  }

  /* WHICH REGION FIRST. The primary, unless the browser has said "the other
     one" — which it says only after a call served by the primary never
     connected its media, the failure a VPN produces and this function cannot
     see. The hint is two allow-listed words that select between endpoints
     the SERVER owns; it can neither name one nor invent one, and it is
     ignored when there is no second region to select. */
  const hint = parseRegionHint(new URL(req.url).searchParams.get("region"));
  const candidates: Array<{ slot: VoiceRegionSlot; cfg: VoiceConfig }> = [];
  if (hint === "alt" && alt) candidates.push({ slot: "alt", cfg: alt });
  if (primary) candidates.push({ slot: "primary", cfg: primary });
  if (alt && !candidates.some((c) => c.slot === "alt")) candidates.push({ slot: "alt", cfg: alt });
  const budgets: readonly number[] = candidates.length > 1 ? TWO_REGION_ATTEMPT_BUDGETS_MS : HANDSHAKE_ATTEMPT_BUDGETS_MS;

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
  /* Set when a region ANSWERED and refused. A refusal and a silence need
     different words for the caller (the client maps 502 to "the service
     refused" and 504 to "the service did not answer") and different
     investigations for us. */
  let rejected = false;
  /* The config that SERVED, once one has. Reassigned per region as the loop
     moves on, so after the loop it names the region whose answer we hold. */
  let cfg: VoiceConfig = candidates[0].cfg;
  let served: VoiceRegionSlot = candidates[0].slot;
  regions: for (const region of candidates) {
  cfg = region.cfg;
  served = region.slot;
  for (let attempt = 1; attempt <= budgets.length; attempt++) {
    /* Set immediately before each fetch, so the elapsed time in the log
       measures that round trip and not the work that preceded it. */
    const startedAt = Date.now();
    const budgetMs = budgets[attempt - 1];
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
      if (!res.ok) {
        /* A REFUSAL IS AN ANSWER, BUT IT IS NOT A CALL. The loop below this
           one was written for a region that could not be REACHED, and it
           treated any HTTP status as "the path works, stop here". Then the
           mainland account's model entitlement lapsed: every handshake came
           back 403 inside a second, the loop stopped on the first region as
           designed, and the second region — its own account, its own key,
           its own entitlement — was never asked. A refusal belongs to the
           account that refused; the next region is a different account, so
           it is tried, at the cost of the one request it takes to ask.

           The body can name hosts, workspace ids and quota state. It is read
           for the log — truncated — and never forwarded. Read here so the
           Response can be dropped; nothing below reads it again. */
        const detail = (await res.text().catch(() => "")).slice(0, 300);
        console.error(
          `[ai.voice] handshake rejected status=${res.status} slot=${region.slot} ` +
            `from=${process.env.VERCEL_REGION ?? "local"} region=${cfg.regionLabel} detail=${detail}`,
        );
        rejected = true;
        res = null;
        continue regions;
      }
      /* SUCCESS IS EVIDENCE TOO, and its absence is why the budgets above are
         still partly a guess. Only failures were ever logged, so nothing
         recorded how long a WORKING handshake takes — which is exactly the
         number needed to decide how long a short attempt should wait before
         giving up on a bad window. Logged at info: it is one line per call
         and it carries no vendor detail. */
      console.log(
        `[ai.voice] handshake ok attempt=${attempt}/${budgets.length} slot=${region.slot} ` +
          `from=${process.env.VERCEL_REGION ?? "local"} region=${cfg.regionLabel} ` +
          `afterMs=${Date.now() - startedAt} budgetMs=${budgetMs}`,
      );
      break regions;
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
          `attempt=${attempt}/${budgets.length} slot=${region.slot} from=${process.env.VERCEL_REGION ?? "local"} ` +
          `region=${cfg.regionLabel} ` +
          `afterMs=${Date.now() - startedAt} budgetMs=${budgetMs} cause=${lastCause}`,
      );
    }
  }
  }

  /* Every region has been asked and none answered with a call. Which WORD the
     client gets depends on what happened: a 502 when at least one region
     answered and refused (the client says "the service refused"), a 504 when
     none answered at all ("the service is not responding"). Both messages are
     the same generic sentence; the reason is in the logs above, where each
     region wrote its own line. */
  if (!res) {
    return NextResponse.json({ error: "Could not start the call. Try again." }, { status: rejected ? 502 : 504 });
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

  /* THE CONVERSATION THIS CALL CONTINUES, if the browser named one. The id is
     a query parameter and is treated as such: parsed strictly, then checked
     against the caller's own tenant and account inside loadRecentTurns
     before a single message is read. An id that is not theirs yields an
     empty list, identical to naming none. Same ceiling and same fail-open
     as the taught index, for the same reason: this can improve a call and
     must never prevent one. */
  let recentTurns: RecentTurn[] = [];
  const conversationId = parseConversationParam(new URL(req.url).searchParams.get("conversation"));
  if (conversationId) {
    try {
      recentTurns = await Promise.race([
        loadRecentTurns(supabaseServer, conversationId, gate.tenantId, gate.accountId),
        new Promise<RecentTurn[]>((resolve) => setTimeout(() => resolve([]), HISTORY_TIMEOUT_MS)),
      ]);
    } catch {
      console.error("[ai.voice] conversation history unavailable — continuing without it");
    }
  }

  /* The caller's UI language, as a hint for transcribing their speech. Three
     values are known; anything else is no hint. The transcript this session
     was saving had an Egyptian sentence come back as Chinese characters, and
     a transcriber that is told the language does not do that. */
  const sttLanguage = parseSttLanguage(new URL(req.url).searchParams.get("stt"));
  const payload = buildVoiceSessionPayload(voice, taughtQuestions, recentTurns, gate.viewer, sttLanguage);
  return NextResponse.json(
    /* WHICH SLOT SERVED, and whether another exists — two neutral words, so
       the browser can ask for "the other one" if this one's media never
       connects. Not a label, not a host, not a vendor: `alt` says nothing
       about where it is. */
    { sdp: answer, session: payload.full, session_compact: payload.compact, region: served, alt_available: candidates.length > 1 },
    { status: 200, headers: { "Cache-Control": "no-store" } },
  );
}
