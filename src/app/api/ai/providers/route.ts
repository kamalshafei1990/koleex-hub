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

export const dynamic = "force-dynamic";
export const maxDuration = 30;

/* Both bounds exist to keep this route inside maxDuration. A slow provider at
   ~4.5s per turn spends 22.5s on five samples, and a route that dies at 30s
   returns NOTHING — the operator loses the samples that already completed as
   well as the ones that did not. So: a hard cap on how many may be asked for,
   and a wall-clock budget checked before each additional sample, which stops
   sampling early and reports what it has. Never a partial-but-silent result. */
const MAX_SAMPLES = 5;
const SAMPLE_BUDGET_MS = 20_000;

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
  const probes = await Promise.all(
    ADAPTERS.filter((a) => {
      try {
        return a.configured();
      } catch {
        return false;
      }
    }).map(async (adapter) => {
      const deadline = Date.now() + SAMPLE_BUDGET_MS;
      const ms: number[] = [];
      let ok = false;
      let status: number | null = null;
      let detail: string | null = null;

      for (let i = 0; i < samples; i++) {
        /* Checked before every sample after the first, so a run always yields
           at least one measurement no matter how slow the provider is. */
        if (i > 0 && Date.now() >= deadline) break;

        const startedAt = Date.now();
        try {
          const out = await chatWithToolsVia(
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
          );
          ms.push(Date.now() - startedAt);
          ok = out.ok === true;
          /* The status is the useful half on a failure: 401 is a bad key,
             402 is an empty balance, 404 is a wrong url or model id. */
          status = out.ok ? 200 : (out.status ?? null);
          /* Truncated hard. A provider error body can echo request content,
             and this response is read by a human in a browser. */
          detail = out.ok ? null : (out.bodyText ?? "").slice(0, 200) || null;
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

  return NextResponse.json({
    providers: roster,
    configured_count: configured.length,
    ...(fallbackProblems ? { fallback_not_configured_because: fallbackProblems } : {}),
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
