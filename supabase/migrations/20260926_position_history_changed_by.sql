-- ---------------------------------------------------------------------------
-- Management — who changed a position (owner's pick, 26 Sep 2026).
--
-- koleex_position_history is the org chart's paper trail: who was assigned
-- to or moved between positions, and when. It lacked the one fact an audit
-- row needs — WHO made the change — and the code had been writing that into
-- a column that did not exist (with two more), so every transfer's history
-- insert failed and only one row was ever recorded.
--
-- ADDITIVE: one nullable column. No row is touched, nothing is removed, RLS
-- (service role only) is unchanged. When an account is deleted its rows stay
-- and forget who wrote them (ON DELETE SET NULL).
-- ---------------------------------------------------------------------------

ALTER TABLE public.koleex_position_history
  ADD COLUMN IF NOT EXISTS changed_by_account_id uuid REFERENCES public.accounts(id) ON DELETE SET NULL;

-- Verification: the column as it now reads.
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'koleex_position_history' AND column_name = 'changed_by_account_id';
