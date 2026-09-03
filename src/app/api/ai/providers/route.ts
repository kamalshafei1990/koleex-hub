import "server-only";

/* ---------------------------------------------------------------------------
   GET /api/ai/providers — is the failover actually configured?

   WHY THIS EXISTS. A fallback provider is contacted ONLY when the primary
   fails. So a mistake in setting it up — a wrong model id, a typo in the base
   url, a key pasted into the name field — stays invisible until the exact
   moment it is needed, which is the moment there is no margin for it. The
   whole point of Phase 4 was to remove "it looks configured and fails when the
   primary is already down"; shipping a fallback nobody can check reintroduces
   that one level up.

   After setting four environment variables and redeploying, an operator had no
   way to answer "did that work?" short of taking the primary down. Now they do.

   WHAT IT WILL NOT TELL YOU. No key, no fragment of a key, no key length, not
   even the full base url — only the adapter's own name, its model id, and
   whether it would serve. `configured()` reads the key and returns a boolean;
   that boolean is all that crosses this boundary.

   SUPER-ADMIN ONLY. Which providers a deployment can reach is operational
   detail, not user-facing. It follows the same rule as /api/qa/ai/tts.

   `?probe=1` GOES FURTHER, and the distinction matters more than it looks.
   Without it this reports CONFIGURED — the variables are present and
   well-formed. That is not the same as WORKING: a well-formed key can still be
   revoked, out of credit, or for the wrong account. The probe sends one
   deliberately tiny turn to each configured provider and reports what came
   back. It costs a few tokens, which is why it is opt-in rather than the
   default.

   `?samples=N` (1..5) REPEATS that turn, because one call cannot tell a cold
   connection from a slow provider. The first Qwen probe returned in 4.5s
   against DeepSeek's 0.66s and there was no way to know which of the two it
   was. Back-to-back samples separate them: the first carries the TLS handshake
   and a cold lambda, the rest do not.

   WHAT THE MILLISECONDS ARE NOT. This is a five-token turn. It measures the
   floor — reaching the provider and getting a first answer out — and a real
   user turn is dominated by things this deliberately excludes: ~9.7K tokens of
   tool schemas on the way in, and a real answer on the way out. Read these
   numbers as "how far away is this provider", never as "how fast is Koleex
   AI". The second question needs the real chat path instrumented, which these
   AI routes still are not.
   --------------------------------------------------------------------------- */

import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/server/auth";
import { providerRoster } from "@/lib/server/ai/provider/registry";
import { chatWithToolsVia } from "@/lib/server/ai/provider/registry";
import { deepseekAdapter } from "@/lib/server/ai/provider/adapters/deepseek";
import { openAiCompatibleAdapter, diagnoseFallbackConfig } from "@/lib/server/ai/provider/adapters/openai-compatible";
import { createBreaker } from "@/lib/server/ai/router/circuit-breaker";
import { latencyStats } from "@/lib/server/ai/observability/latency-stats";
import { voiceConfigured, diagnoseVoiceConfig, type VoiceEnv } from "@/lib/server/ai/voice/config";
import { probeVoice } from "@/lib/server/ai/voice/probe";
import { imageGenConfigured, diagnoseImageConfig, readImageEnv } from "@/lib/server/ai/image-gen";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

/* THE FIRST VERSION OF THIS TIMED OUT IN PRODUCTION, twice, and the reason is
   worth keeping: it bounded when a sample may START, not how long the run may
   TAKE. `elapsed < 20s` happily begins a sample at 19.9s that then runs for
   ten more, and 30s later Vercel kills the function and the operator gets a
   504 with none of the samples that did complete — the exact outcome the
   budget was written to prevent.

   The bad assumption underneath was that one sample is one round trip. It is
   not. core/transport.ts retries up to MAX_RETRIES=3 with backoff capped at
   8s, and 429 is one of the statuses it retries — which is precisely what
   five back-to-back calls to a rate-limiting provider produce. One "sample"
   can therefore consume 24s on its own.

   So the rule is now a bound on the TOTAL: a sample may only start if it could
   run for its full cap and still finish inside the budget. With a cap of 8s
   and a budget of 24s the worst case is 24s, comfortably inside maxDuration=30
   with room for auth and serialisation — and when samples are fast (600ms)
   the predicate is satisfied every time, so all five still run. */
const MAX_SAMPLES = 5;
const SAMPLE_BUDGET_MS = 24_000;

/* A ceiling on ONE sample, enforced by racing rather than by cancelling: the
   shared transport takes no AbortSignal, and threading one through it is a
   change to the live turn path that does not belong in a status route. The
   fetch it abandons keeps running until the function ends, which costs
   nothing here and is not worth the hot-path edit to avoid.

   Eight seconds is also a judgement, not just a guard. A five-token turn that
   has not answered in 8s is not reporting latency any more — it is reporting
   retries and backoff — and letting it run would quietly inflate the median
   with sleep time. Better to mark it and say so. */
const PER_SAMPLE_CAP_MS = 8_000;

/** Resolves to `TIMED_OUT` rather than rejecting, so a capped sample is a
 *  reported outcome and never an exception that loses the samples before it. */
const TIMED_OUT = Symbol("probe-sample-timed-out");
function withCap<T>(work: Promise<T>): Promise<T | typeof TIMED_OUT> {
  return Promise.race([
    work,
    new Promise<typeof TIMED_OUT>((resolve) =>
      setTimeout(() => resolve(TIMED_OUT), PER_SAMPLE_CAP_MS),
    ),
  ]);
}

export async function GET(req: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  if (!auth.is_super_admin) {
    return NextResponse.json({ error: "Not authorised." }, { status: 403 });
  }

  const roster = providerRoster();
  const configured = roster.filter((p) => p.configured);

  /* When the fallback is NOT configured, say WHY. An operator who has just set
     four variables and sees `configured: false` otherwise has to guess between
     four indistinguishable causes; naming the one that fired is the difference
     between a redeploy and an evening. Variable NAMES only — never values. */
  const fallbackProblems = roster.some((p) => p.name === "fallback" && !p.configured)
    ? diagnoseFallbackConfig({
        AI_FALLBACK_BASE_URL: process.env.AI_FALLBACK_BASE_URL,
        AI_FALLBACK_API_KEY: process.env.AI_FALLBACK_API_KEY,
        AI_FALLBACK_MODEL: process.env.AI_FALLBACK_MODEL,
      })
    : null;

  /* VOICE IS REPORTED THE SAME WAY AND FOR A STRONGER REASON. The fallback can
     at least be exercised by taking the primary down; voice cannot be
     exercised at all without a browser, a microphone and a peer connection.
     Four variables, a redeploy, and no way to answer "did that work?" is
     exactly the position this route was written to end. */
  const voiceEnv = (): VoiceEnv => ({
    AI_VOICE_BASE_URL: process.env.AI_VOICE_BASE_URL,
    AI_VOICE_API_KEY: process.env.AI_VOICE_API_KEY,
    AI_VOICE_MODEL: process.env.AI_VOICE_MODEL,
    AI_VOICE_REGION_LABEL: process.env.AI_VOICE_REGION_LABEL,
  });
  const voiceIsConfigured = voiceConfigured(voiceEnv());
  const voiceStatus = {
    configured: voiceIsConfigured,
    ...(voiceIsConfigured ? {} : { not_configured_because: diagnoseVoiceConfig(voiceEnv()) }),
  };

  /* IMAGE CREATION, the same way. Not probed: a probe would be a paid
     picture, and "configured" plus the variable names is what an operator
     needs to finish the setup. The first real request is the probe. */
  const imageIsConfigured = imageGenConfigured(readImageEnv());
  const imageStatus = {
    configured: imageIsConfigured,
    ...(imageIsConfigured ? {} : { not_configured_because: diagnoseImageConfig(readImageEnv()) }),
  };

  const params = new URL(req.url).searchParams;
  const wantProbe = params.get("probe") === "1";

  /* `?samples=N` — how many turns to send to EACH provider, back to back.
     One sample cannot tell a cold connection apart from a slow provider, and
     that was exactly the open question: a fallback answered in 4.5s on its
     first call and there was no way to know whether that was the TLS handshake
     and a cold lambda, or the model. N samples in a row answer it, because the
     first carries the setup cost and the rest do not.

     Clamped to MAX_SAMPLES, and floored, because this parameter costs real
     tokens and real seconds per unit and is reachable from a browser address
     bar. `Math.floor(Number(...))` on "abc" is NaN, which `|| 1` catches. */
  const samples = Math.min(
    MAX_SAMPLES,
    Math.max(1, Math.floor(Number(params.get("samples"))) || 1),
  );

  if (!wantProbe) {
    return NextResponse.json({
      providers: roster,
      configured_count: configured.length,
      ...(fallbackProblems ? { fallback_not_configured_because: fallbackProblems } : {}),
      voice: voiceStatus,
      image: imageStatus,
      /* Said plainly, because "configured" reads as "working" and is not.
         An operator who stops at this line should know what they have. */
      note:
        configured.length < 2
          ? "Only one provider is configured — there is no failover. Add AI_FALLBACK_BASE_URL, AI_FALLBACK_API_KEY and AI_FALLBACK_MODEL, then redeploy."
          : "Configured is not the same as working — add ?probe=1 to send one tiny real turn to each.",
    });
  }

  /* THE PROBE MUST NOT MOVE THE REAL BREAKER, and until now it did. The shared
     `providerBreaker` is what takes a provider out of rotation for live turns,
     and chatWithToolsVia writes to it by default. So a probe of a sick provider
     recorded failures against real traffic — three of them opens the breaker —
     and a probe of a recovering one recorded a success that RESET a breaker
     which live turns had legitimately opened, hiding an outage at the moment it
     mattered. A diagnostic that changes what it is diagnosing is worse than no
     diagnostic. This breaker is created per request and thrown away with it. */
  const probeBreaker = createBreaker();

  /* One provider at a time, each on its own, so the result names WHICH one
     failed. Going through chatWithToolsVia with a single-adapter list reuses
     the real call path rather than a parallel one written for this route.

     Providers run CONCURRENTLY with each other but their samples run in
     SEQUENCE. Sequence within a provider is the point — back-to-back turns are
     what separate the cold first call from the warm rest. Concurrency across
     providers is a deliberate trade: measuring them one after the other would
     double the wall clock and blow maxDuration. These are I/O waits on
     different hosts, so the overlap costs little, but it is an overlap and the
     numbers should be read as such. */
  const ADAPTERS = [deepseekAdapter, openAiCompatibleAdapter];
  /* Started BEFORE the provider probes are awaited so it overlaps them rather
     than adding its 8s cap to the run. It is one request to a different host,
     so the overlap costs effectively nothing against maxDuration=30. */
  const voiceProbePromise = probeVoice(voiceEnv());

  const probes = await Promise.all(
    ADAPTERS.filter((a) => {
      try {
        return a.configured();
      } catch {
        return false;
      }
    }).map(async (adapter) => {
      const startedRunAt = Date.now();
      const ms: number[] = [];
      let ok = false;
      let status: number | null = null;
      let detail: string | null = null;
      let capped = false;

      for (let i = 0; i < samples; i++) {
        /* The bound that matters: only begin a sample that could run for its
           whole cap and still land inside the budget. The first is exempt so a
           run always yields at least one measurement. */
        if (i > 0 && Date.now() - startedRunAt + PER_SAMPLE_CAP_MS > SAMPLE_BUDGET_MS) break;

        const startedAt = Date.now();
        try {
          const out = await withCap(
            chatWithToolsVia(
              [adapter],
              {
                messages: [{ role: "user", content: "Reply with the single word: ok" }],
                /* Deliberately tiny. This proves the credential and the endpoint,
                   not the model's quality — and it is the TRANSPORT FLOOR, not
                   what a user waits: a real turn carries the tool schemas and
                   generates a real answer, both of which dwarf five tokens. */
                maxTokens: 5,
                temperature: 0,
              },
              { breaker: probeBreaker },
            ),
          );
          ms.push(Date.now() - startedAt);
          if (out === TIMED_OUT) {
            /* NOT recorded as a latency figure by omission — it is in `ms`,
               but the flag says the number is a cap, not a measurement. */
            capped = true;
            ok = false;
            status = null;
            detail = `no answer within ${PER_SAMPLE_CAP_MS}ms — at this size that is retries and backoff, not latency (transport retries 429 up to 3 times)`;
          } else {
            ok = out.ok === true;
            /* The status is the useful half on a failure: 401 is a bad key,
               402 is an empty balance, 404 is a wrong url or model id. */
            status = out.ok ? 200 : (out.status ?? null);
            /* Truncated hard. A provider error body can echo request content,
               and this response is read by a human in a browser. */
            detail = out.ok ? null : (out.bodyText ?? "").slice(0, 200) || null;
          }
        } catch (e) {
          ms.push(Date.now() - startedAt);
          ok = false;
          status = null;
          detail = e instanceof Error ? e.message.slice(0, 200) : "probe threw";
        }

        /* Stop on the first failure. Four more identical 401s cost four more
           round trips and tell the operator nothing the first one did not. */
        if (!ok) break;
      }

      return {
        name: adapter.name,
        ok,
        status,
        ...(capped ? { timed_out: true } : {}),
        /* `ms` keeps its original meaning exactly — the FIRST call, setup cost
           included — so a caller reading this field before samples existed
           reads the same thing now. */
        ms: ms[0] ?? 0,
        detail,
        ...(ms.length > 1
          ? (() => {
              const st = latencyStats(ms);
              return st
                ? { ms_samples: ms, ms_min: st.min, ms_median: st.median, ms_max: st.max }
                : { ms_samples: ms };
            })()
          : {}),
      };
    }),
  );

  const voiceProbe = await voiceProbePromise;

  return NextResponse.json({
    providers: roster,
    configured_count: configured.length,
    ...(fallbackProblems ? { fallback_not_configured_because: fallbackProblems } : {}),
    voice: { ...voiceStatus, ...(voiceProbe ? { probe: voiceProbe } : {}) },
    image: imageStatus,
    probes,
    ...(samples > 1
      ? {
          /* Said explicitly because the number invites the wrong reading. This
             is a five-token turn: it measures reaching the provider and getting
             started, not what a user waits for an answer. */
          measured: `${samples} samples per provider. \`ms\` is the first call (setup included); \`ms_min\`/\`ms_median\`/\`ms_max\` cover all of them. This is the TRANSPORT FLOOR of a 5-token turn — a real turn also carries the tool schemas and generates a real answer.`,
        }
      : {}),
    note: probes.every((p) => p.ok)
      ? "Every configured provider answered."
      : "At least one provider did NOT answer — see `status`: 401 bad key, 402 no credit, 404 wrong url or model id.",
  });
}
