-- ===========================================================================
-- APPLIED 2026-08-30, with owner sign-off.
--   staging    gmtjbshjsuexqayqumix  → atomic increment proved (3 separate
--                                      calls on one key = 3; separate buckets
--                                      and subjects do not share a counter)
--   production yxyizbnfjrwrnmwhkvme  → verified 5 cols, RLS on, 0 policies,
--                                      anon + authenticated denied, 0 rows
-- Test rows removed from staging afterwards.
--
-- Phase 1 · audit Issue 4 (P0) — AI rate limiting.
--
-- REASON
-- ------
-- Nothing limited AI request volume, token consumption, concurrency or vision
-- calls. `src/lib/server/rate-limit.ts` exists but is login-specific, defaults
-- to "off", and states "It NEVER blocks a request in this stage."
--
-- The only barriers were authentication and requireInternalUser — meaningful
-- against strangers, useless against a compromised account or a client stuck
-- in a retry loop. One authenticated user scripting /api/ai/agent drives four
-- model calls of 2048 tokens each per request, with no counter and no alert:
-- the first signal is the vendor invoice. /api/ai/attachments is worse, at up
-- to 18 vision calls per single HTTP request.
--
-- WHY A TABLE (option B of the three in the plan, §Q)
-- --------------------------------------------------
-- Vercel functions are stateless, so an in-process counter is per-instance: an
-- attacker across N warm instances gets N x the limit. That bounds a runaway
-- client loop but not an attacker, and shipping it as "rate limiting" would be
-- dishonest. Marketplace Redis (option A) is the textbook answer but adds a
-- vendor; this reuses infrastructure that already exists and follows a pattern
-- already in the tree (login_attempts).
--
-- EXPECTED LOAD
-- -------------
-- One upsert per AI request; rows are tiny and expire by window. A few hundred
-- rows/day at current usage.
--
-- ROLLBACK
-- --------
--   drop function if exists public.ai_rate_limit_hit(text, text, timestamptz);
--   drop table if exists public.ai_rate_limits;
-- Plus AI_RATE_LIMIT=off, which restores today's behaviour without a deploy.
-- ===========================================================================

create table if not exists public.ai_rate_limits (
  -- "account:<uuid>" | "tenant:<uuid>" | "ip:<addr>" — keyed by STRING so a new
  -- subject type needs no migration.
  subject       text        not null,
  -- Which budget: "turn" | "turn:tenant" | "attachment" | future classes.
  bucket        text        not null,
  -- Fixed window start, truncated by the caller.
  window_start  timestamptz not null,
  count         integer     not null default 0,
  updated_at    timestamptz not null default now(),
  primary key (subject, bucket, window_start)
);

comment on table public.ai_rate_limits is
  'Fixed-window request counters for Koleex AI. One atomic upsert per check; rows expire by window and are swept. Not an audit trail — ai_tool_calls is.';

create index if not exists ai_rate_limits_window_idx
  on public.ai_rate_limits (window_start);

alter table public.ai_rate_limits enable row level security;
revoke all on public.ai_rate_limits from anon, authenticated;

-- Atomic single-statement increment. Without it the caller must
-- read-then-write, which races under concurrency — exactly the case a limiter
-- exists for.
create or replace function public.ai_rate_limit_hit(
  p_subject text,
  p_bucket  text,
  p_window  timestamptz
) returns table (count integer)
language sql
as $$
  insert into public.ai_rate_limits (subject, bucket, window_start, count)
  values (p_subject, p_bucket, p_window, 1)
  on conflict (subject, bucket, window_start)
    do update set count = ai_rate_limits.count + 1, updated_at = now()
  returning ai_rate_limits.count;
$$;

revoke all on function public.ai_rate_limit_hit(text, text, timestamptz) from anon, authenticated;
