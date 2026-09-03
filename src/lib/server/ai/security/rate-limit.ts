import "server-only";

/* ---------------------------------------------------------------------------
   security/rate-limit — request budgets for the AI endpoints.

   THE PROBLEM THIS SOLVES (audit Issue 4, P0)
   -------------------------------------------
   Nothing limited AI request volume, token consumption, concurrency or vision
   calls. `src/lib/server/rate-limit.ts` exists but is login-specific, defaults
   to "off", and says so itself: "It NEVER blocks a request in this stage."

   The only barriers were authentication and requireInternalUser — meaningful
   against strangers, useless against a compromised account or a buggy client
   retry loop. One authenticated user scripting /api/ai/agent drives four model
   calls of 2048 tokens each per request, in a loop, with no counter and no
   alert: the first signal is the vendor invoice. /api/ai/attachments is worse,
   at up to 18 vision calls per HTTP request.

   WHY A TABLE AND NOT AN IN-PROCESS MAP
   -------------------------------------
   Vercel functions are stateless and ephemeral. A per-instance counter gives
   an attacker spread across N warm instances N times the limit. It would bound
   a runaway client loop but not an attacker, and calling that "rate limiting"
   would be the same class of error as an assertion that reports an open issue
   as fixed. The counter is therefore in Postgres, incremented by ONE atomic
   statement so two concurrent requests cannot both read a stale value.

   FAIL-OPEN, DELIBERATELY
   -----------------------
   If the counter store is unreachable the request is ALLOWED, with a log line.
   A limiter that takes the assistant down when the database hiccups converts a
   cost-control measure into an availability incident. The audit trail
   (ai_tool_calls) still records everything either way.
   --------------------------------------------------------------------------- */

import { supabaseServer } from "../../supabase-server";

export type LimitMode = "enforce" | "observe" | "off";

export function limitMode(): LimitMode {
  const v = (process.env.AI_RATE_LIMIT ?? "enforce").toLowerCase();
  return v === "off" || v === "observe" ? v : "enforce";
}

/** Budget classes. `windowSec` is the fixed window; `max` the ceiling within it.
 *  Env-overridable so an operator can tune without a deploy. */
export interface Budget {
  bucket: string;
  windowSec: number;
  max: number;
}

const num = (v: string | undefined, d: number) => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : d;
};

/* Defaults chosen to be invisible to a person and obvious to a loop. A human
   sends a handful of AI turns a minute; 30 is far above real use and far below
   what a script costs. Attachments are much more expensive per request (each
   can fan out to 18 vision calls), so they get their own, tighter budget. */
export const BUDGETS = {
  turnPerAccount: (): Budget => ({
    bucket: "turn",
    windowSec: 60,
    max: num(process.env.AI_LIMIT_TURNS_PER_MIN, 30),
  }),
  turnPerTenant: (): Budget => ({
    bucket: "turn:tenant",
    windowSec: 60,
    max: num(process.env.AI_LIMIT_TENANT_TURNS_PER_MIN, 200),
  }),
  attachmentPerAccount: (): Budget => ({
    bucket: "attachment",
    windowSec: 60,
    max: num(process.env.AI_LIMIT_ATTACHMENTS_PER_MIN, 6),
  }),
  /* A call posts each settled turn as it lands — a lively exchange is one or
     two a minute per side, so 60 is far above a person and cheap to hit from
     a loop. Each post is a database write and nothing more. */
  voiceTranscriptPerAccount: (): Budget => ({
    bucket: "voice_transcript",
    windowSec: 60,
    max: num(process.env.AI_LIMIT_VOICE_TRANSCRIPTS_PER_MIN, 60),
  }),
  /* A call summary is one model call at hang-up. A person ends a handful of
     calls an hour; six a minute is far above that and stops a loop from
     turning hang-up into a bill. */
  voiceSummaryPerAccount: (): Budget => ({
    bucket: "voice_summary",
    windowSec: 60,
    max: num(process.env.AI_LIMIT_VOICE_SUMMARIES_PER_MIN, 6),
  }),
  /* A search box, typed into. Debounced on the client; this is the floor
     under a client that is not. */
  conversationSearchPerAccount: (): Budget => ({
    bucket: "conv_search",
    windowSec: 60,
    max: num(process.env.AI_LIMIT_CONVERSATION_SEARCHES_PER_MIN, 30),
  }),
  /* A generated picture is paid per call — the one AI surface where a loop
     is a bill rather than a load. Per account per HOUR, and per tenant per
     DAY, because a whole company's allowance is the number the owner
     actually reasons about. Both are checked before the vendor is paid. */
  imagePerAccount: (): Budget => ({
    bucket: "image",
    windowSec: 3600,
    max: num(process.env.AI_LIMIT_IMAGES_PER_HOUR, 10),
  }),
  imagePerTenant: (): Budget => ({
    bucket: "image:tenant",
    windowSec: 86_400,
    max: num(process.env.AI_LIMIT_TENANT_IMAGES_PER_DAY, 100),
  }),
} as const;

export type LimitResult =
  | { allowed: true; count: number; max: number }
  | { allowed: false; count: number; max: number; retryAfterSec: number };

function windowStart(windowSec: number): string {
  const now = Date.now();
  return new Date(Math.floor(now / (windowSec * 1000)) * windowSec * 1000).toISOString();
}

/**
 * Count one request against a budget.
 *
 * The increment is a single upsert, so concurrent requests serialise on the
 * row rather than racing a read-then-write.
 */
export async function consumeBudget(subject: string, budget: Budget): Promise<LimitResult> {
  const ws = windowStart(budget.windowSec);
  try {
    /* `count` is passed as the INSERT value and incremented on conflict, so the
       first request in a window lands 1 and every later one adds exactly 1. */
    const { data, error } = await supabaseServer
      .rpc("ai_rate_limit_hit", { p_subject: subject, p_bucket: budget.bucket, p_window: ws })
      .maybeSingle();

    if (error) {
      /* No RPC deployed (or it failed) — fall back to a read-modify-write.
         Slightly weaker under heavy concurrency, still far better than nothing,
         and it keeps this module working on a database where the helper
         function has not been created. */
      const { data: row } = await supabaseServer
        .from("ai_rate_limits")
        .select("count")
        .eq("subject", subject).eq("bucket", budget.bucket).eq("window_start", ws)
        .maybeSingle();
      const next = ((row?.count as number | undefined) ?? 0) + 1;
      await supabaseServer.from("ai_rate_limits").upsert(
        { subject, bucket: budget.bucket, window_start: ws, count: next, updated_at: new Date().toISOString() },
        { onConflict: "subject,bucket,window_start" },
      );
      return verdict(next, budget, ws);
    }

    const count = ((data as { count?: number } | null)?.count ?? 1);
    return verdict(count, budget, ws);
  } catch (e) {
    /* FAIL OPEN — see the header. A limiter must not become an outage. */
    console.error("[ai.ratelimit.store]", e instanceof Error ? e.message : String(e));
    return { allowed: true, count: 0, max: budget.max };
  }
}

function verdict(count: number, budget: Budget, ws: string): LimitResult {
  if (count <= budget.max) return { allowed: true, count, max: budget.max };
  const elapsed = (Date.now() - Date.parse(ws)) / 1000;
  return {
    allowed: false,
    count,
    max: budget.max,
    retryAfterSec: Math.max(1, Math.ceil(budget.windowSec - elapsed)),
  };
}

/** Subject keys. Kept here so every caller spells them the same way — a typo
 *  would silently create a second, empty budget rather than failing. */
export const subjectFor = {
  account: (id: string) => `account:${id}`,
  tenant: (id: string) => `tenant:${id}`,
  ip: (addr: string) => `ip:${addr}`,
};
