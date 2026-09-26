-- ===========================================================================
-- APPLIED 2026-08-30, with owner sign-off.
--   staging    gmtjbshjsuexqayqumix  → verified 14 cols, 4 indexes, RLS on,
--                                      0 policies, anon + authenticated denied
--   production yxyizbnfjrwrnmwhkvme  → same verification, 0 rows
-- Atomic-consume proved on staging: legitimate confirm 1, replay 0,
-- expired 0, fabricated-without-preview 0. Test rows removed.
--
-- Phase 1 · audit Issue 1 (P0) — server-enforced write confirmation.
--
-- REASON
-- ------
-- Fifteen write tools implement a two-phase preview/confirm pattern, but
-- NOTHING on the server verifies a preview ever happened. The only thing
-- separating a preview from an execution is the model choosing to omit
-- `confirm: true`:
--
--     if (args.confirm !== true) { return preview }   // tools/todos.ts:906
--
-- `preToolGuard()` never inspects `confirm`. `dispatchTool()` never inspects
-- `confirm` (grep count: 0). And `pendingAction`, which 15 tools return, is
-- read by nothing — verified across all of src/.
--
-- So a model that emits `deleteTodo({task_id, confirm:true})` on its FIRST
-- call deletes the task, with no preview and no user consent. The rule against
-- it exists only in the system prompt. Six tools delete permanently.
--
-- This is also what makes prompt injection consequential: injected text in an
-- uploaded document cannot read data it lacks permission for, but it CAN
-- trigger a write the user is entitled to make.
--
-- WHY A TABLE AND NOT MEMORY
-- --------------------------
-- Vercel functions are stateless and ephemeral (see CLAUDE.md); an in-process
-- map would not survive between the preview request and the confirm request,
-- which are separate invocations. The ledger must be durable and shared.
--
-- WHY NOT REUSE AN EXISTING TABLE
-- -------------------------------
-- Considered and rejected: `ai_tool_calls` is an append-only audit trail with
-- scrubbed arguments — it deliberately does NOT retain the exact args needed to
-- match a confirmation, and giving an audit table a mutable status column would
-- compromise its one job. No other table has the right lifecycle.
--
-- EXPECTED LOAD
-- -------------
-- One row per write-tool PREVIEW. Writes are a small minority of AI turns.
-- Order of tens to low hundreds of rows/day at current usage; rows expire in
-- minutes. Two indexed point-lookups per confirmed write. Negligible.
--
-- ROLLBACK
-- --------
--   drop table if exists public.ai_pending_actions;
-- Plus AI_CONFIRM_LEDGER=off, which restores today's behaviour without a
-- deploy. The table can be left in place unused with zero effect.
-- ===========================================================================

create table if not exists public.ai_pending_actions (
  id               uuid primary key default gen_random_uuid(),
  tenant_id        uuid not null,
  account_id       uuid not null,
  conversation_id  uuid,

  tool_name        text not null,
  -- Canonical JSON of the arguments with `confirm` removed and keys sorted, so
  -- the same intent hashes identically whichever order the model emits.
  normalized_args  jsonb not null,
  -- sha256 of normalized_args. The match key: a confirm must present the same
  -- (conversation, tool, args) as the preview that authorised it.
  args_hash        text not null,
  -- What the USER was actually shown. Stored so an auditor can answer "what did
  -- they agree to?", not merely "did they agree?".
  preview_payload  jsonb,
  -- Declared risk class (agent safety matrix): high_risk_write | destructive |
  -- financial | external_side_effect. Destructive may later require a stronger
  -- acknowledgement than a plain confirm.
  risk_class       text not null default 'high_risk_write',

  status           text not null default 'pending',  -- pending|confirmed|cancelled|expired
  created_at       timestamptz not null default now(),
  -- Short by design: a confirmation is consent to an action the user is looking
  -- at right now. A stale approval is not consent.
  expires_at       timestamptz not null default now() + interval '15 minutes',
  confirmed_at     timestamptz,
  cancelled_at     timestamptz
);

-- The hot path: "is there an unexpired pending action matching this confirm?"
create index if not exists ai_pending_actions_match_idx
  on public.ai_pending_actions (conversation_id, tool_name, args_hash, status);
-- Expiry sweep.
create index if not exists ai_pending_actions_expiry_idx
  on public.ai_pending_actions (expires_at)
  where status = 'pending';
-- Per-user listing (UI: "you have a pending action").
create index if not exists ai_pending_actions_account_idx
  on public.ai_pending_actions (account_id, created_at desc);

-- Same posture as qa_ai_sessions_phase8.sql: RLS on, NO policies, service-role
-- only. The API layer is the security boundary (see supabase-server.ts).
alter table public.ai_pending_actions enable row level security;
revoke all on public.ai_pending_actions from anon, authenticated;
